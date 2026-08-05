(() => {
  const OWNER = "cayadservices";
  const REPO = "CayadServices";
  const BRANCH = "main";
  const POSTS_PATH = "src/content/blog";
  const IMAGES_PATH = "public/img/blog";
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const state = { token: "", posts: [], editing: null, pendingCover: null };

  const loginView = $("#login-view");
  const studio = $("#studio");
  const editorOverlay = $("#editor-overlay");
  const form = $("#editor-form");
  const toast = $("#toast");

  function notify(message, error = false) {
    toast.textContent = message;
    toast.className = `toast show${error ? " error" : ""}`;
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => { toast.className = "toast"; }, 3200);
  }

  function api(path, options = {}) {
    return fetch(`https://api.github.com${path}`, {
      ...options,
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${state.token}`, "X-GitHub-Api-Version": "2022-11-28", ...options.headers },
    }).then(async (response) => {
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || `GitHub error ${response.status}`); }
      return response.status === 204 ? null : response.json();
    });
  }

  const decode = (value) => decodeURIComponent(escape(atob(value.replace(/\n/g, ""))));
  const encode = (value) => btoa(unescape(encodeURIComponent(value)));
  const escapeHtml = (value = "") => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const slugify = (value) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  function parsePost(raw, file) {
    const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    const data = {};
    if (match) match[1].split("\n").forEach((line) => {
      const separator = line.indexOf(":");
      if (separator < 0) return;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      try { data[key] = JSON.parse(value); }
      catch { data[key] = value; }
    });
    return { ...data, body: match?.[2] || "", slug: file.name.replace(/\.md$/, ""), path: file.path, sha: file.sha };
  }

  function serializePost(data) {
    const fields = ["title", "excerpt", "publishedAt", "author", "state", "tags", "coverImage", "coverAlt", "featured", "draft", "seoTitle", "seoDescription"];
    const frontmatter = fields.filter((key) => data[key] !== "" && data[key] != null).map((key) => `${key}: ${JSON.stringify(data[key])}`).join("\n");
    return `---\n${frontmatter}\n---\n\n${data.body.trim()}\n`;
  }

  async function loadPosts() {
    $("#content-list").innerHTML = '<div class="loading">Loading the roadbook…</div>';
    const files = await api(`/repos/${OWNER}/${REPO}/contents/${POSTS_PATH}?ref=${BRANCH}`);
    const markdown = files.filter((file) => file.name.endsWith(".md"));
    state.posts = await Promise.all(markdown.map(async (file) => parsePost(decode((await api(`/repos/${OWNER}/${REPO}/contents/${file.path}?ref=${BRANCH}`)).content), file)));
    state.posts.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
    $("#post-count").textContent = state.posts.length;
    renderPosts();
  }

  function renderPosts() {
    const term = $("#admin-search").value.trim().toLowerCase();
    const posts = state.posts.filter((post) => `${post.title} ${post.state} ${(post.tags || []).join(" ")}`.toLowerCase().includes(term));
    $("#content-list").innerHTML = posts.length ? posts.map((post) => `<article class="post-row" data-slug="${escapeHtml(post.slug)}"><img src="${escapeHtml(post.coverImage)}" alt=""/><div><h2>${escapeHtml(post.title)}</h2><p>${escapeHtml(post.state || "Nationwide")} · ${(post.tags || []).map(escapeHtml).join(" · ")}</p></div><span>${escapeHtml(post.publishedAt || "")}</span><span class="status${post.draft ? " draft" : ""}">${post.draft ? "Draft" : "Published"}</span><b>›</b></article>`).join("") : '<div class="empty-list">No articles found.</div>';
    $$(".post-row").forEach((row) => row.addEventListener("click", () => openEditor(state.posts.find((post) => post.slug === row.dataset.slug))));
  }

  function openEditor(post = null) {
    state.editing = post;
    state.pendingCover = null;
    form.reset();
    $("#editor-mode").textContent = post ? "Edit article" : "New article";
    $("#editor-heading").textContent = post?.title || "Untitled guide";
    $("#delete-post").hidden = !post;
    const values = post || { publishedAt: new Date().toISOString().slice(0, 10), author: "Cayad Auto Transport", featured: false, draft: false };
    [...form.elements].forEach((field) => {
      if (!field.name || values[field.name] == null) return;
      if (field.type === "checkbox") field.checked = Boolean(values[field.name]);
      else field.value = Array.isArray(values[field.name]) ? values[field.name].join(", ") : values[field.name];
    });
    setCoverPreview(values.coverImage || "");
    $("#excerpt-count").textContent = String((values.excerpt || "").length);
    editorOverlay.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => $("#title").focus(), 50);
  }

  function closeEditor() { editorOverlay.hidden = true; document.body.style.overflow = ""; }
  function setCoverPreview(src) { $("#coverImage").value = src; $("#cover-preview").src = src; $("#cover-preview").hidden = !src; $("#cover-placeholder").hidden = Boolean(src); }
  function insertText(before, after = "") { const area = $("#body"); const start = area.selectionStart; const end = area.selectionEnd; area.setRangeText(before + area.value.slice(start, end) + after, start, end, "end"); area.focus(); }

  function selectImage(kind) {
    const input = kind === "cover" ? $("#cover-file") : $("#body-image-file");
    input.value = "";
    input.click();
  }

  async function prepareImage(file, kind) {
    if (!file || file.size > 5 * 1024 * 1024) return notify("Images must be smaller than 5 MB.", true);
    const slug = $("#slug").value || slugify($("#title").value) || "article";
    const extension = file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "webp";
    const filename = `${slug}-${kind}-${Date.now()}.${extension}`;
    const path = `${IMAGES_PATH}/${filename}`;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const item = { path, publicPath: `/img/blog/${filename}`, content: dataUrl.split(",")[1] };
      if (kind === "cover") { state.pendingCover = item; setCoverPreview(dataUrl); }
      else { uploadImage(item).then(() => { insertText(`\n![Describe this image](${item.publicPath})\n`); notify("Image uploaded and added to the article."); }).catch((error) => notify(error.message, true)); }
    };
    reader.readAsDataURL(file);
  }

  async function uploadImage(item) {
    await api(`/repos/${OWNER}/${REPO}/contents/${item.path}`, { method: "PUT", body: JSON.stringify({ message: `content: upload ${item.path.split("/").pop()}`, content: item.content, branch: BRANCH }) });
    return item.publicPath;
  }

  async function savePost(event) {
    event.preventDefault();
    const button = $("#save-post");
    button.disabled = true; button.querySelector("span").textContent = "Publishing…";
    try {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      data.featured = form.elements.featured.checked;
      data.draft = form.elements.draft.checked;
      data.tags = String(data.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
      data.slug = slugify(data.slug || data.title);
      if (state.pendingCover) data.coverImage = await uploadImage(state.pendingCover);
      if (!data.coverImage) throw new Error("Please upload a cover image.");
      const path = `${POSTS_PATH}/${data.slug}.md`;
      const body = { message: `content: ${state.editing ? "update" : "publish"} ${data.title}`, content: encode(serializePost(data)), branch: BRANCH };
      if (state.editing && state.editing.path === path) body.sha = state.editing.sha;
      else {
        const existing = state.posts.find((post) => post.slug === data.slug);
        if (existing) body.sha = existing.sha;
      }
      await api(`/repos/${OWNER}/${REPO}/contents/${path}`, { method: "PUT", body: JSON.stringify(body) });
      if (state.editing && state.editing.path !== path) await api(`/repos/${OWNER}/${REPO}/contents/${state.editing.path}`, { method: "DELETE", body: JSON.stringify({ message: `content: rename ${state.editing.slug} to ${data.slug}`, sha: state.editing.sha, branch: BRANCH }) });
      notify(data.draft ? "Draft saved. The site is rebuilding." : "Article published. The site is rebuilding.");
      closeEditor(); await loadPosts();
    } catch (error) { notify(error.message, true); }
    finally { button.disabled = false; button.querySelector("span").textContent = "Publish article"; }
  }

  async function deletePost() {
    if (!state.editing || !confirm(`Delete “${state.editing.title}”? This creates a reversible Git commit.`)) return;
    try { await api(`/repos/${OWNER}/${REPO}/contents/${state.editing.path}`, { method: "DELETE", body: JSON.stringify({ message: `content: remove ${state.editing.title}`, sha: state.editing.sha, branch: BRANCH }) }); notify("Article deleted. The site is rebuilding."); closeEditor(); await loadPosts(); }
    catch (error) { notify(error.message, true); }
  }

  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault(); state.token = $("#token").value.trim(); $("#login-error").textContent = "";
    try {
      const user = await api("/user");
      await api(`/repos/${OWNER}/${REPO}`);
      $("#user-name").textContent = user.name || user.login;
      $("#user-avatar").innerHTML = `<img src="${escapeHtml(user.avatar_url)}" alt=""/>`;
      loginView.hidden = true; studio.hidden = false; await loadPosts();
    } catch (error) { state.token = ""; $("#login-error").textContent = "Access denied. Check the token and repository permission."; }
  });
  $("#toggle-token").addEventListener("click", () => { const token = $("#token"); token.type = token.type === "password" ? "text" : "password"; $("#toggle-token").textContent = token.type === "password" ? "Show" : "Hide"; });
  $("#logout").addEventListener("click", () => { state.token = ""; $("#token").value = ""; studio.hidden = true; loginView.hidden = false; });
  $("#new-post").addEventListener("click", () => openEditor());
  $("#close-editor").addEventListener("click", closeEditor);
  $("#mobile-menu").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
  $("#admin-search").addEventListener("input", renderPosts);
  $("#title").addEventListener("input", (event) => { $("#editor-heading").textContent = event.target.value || "Untitled guide"; if (!state.editing) $("#slug").value = slugify(event.target.value); });
  $("#excerpt").addEventListener("input", (event) => { $("#excerpt-count").textContent = event.target.value.length; });
  $$("[data-insert]").forEach((button) => button.addEventListener("click", () => { const [before, after = ""] = button.dataset.insert.split("|"); insertText(before, after); }));
  $$("[data-wrap]").forEach((button) => button.addEventListener("click", () => { const [before, after = ""] = button.dataset.wrap.split("|"); insertText(before, after); }));
  $("#cover-upload").addEventListener("click", () => selectImage("cover"));
  $("#body-image").addEventListener("click", () => selectImage("body"));
  $("#cover-file").addEventListener("change", (event) => prepareImage(event.target.files[0], "cover"));
  $("#body-image-file").addEventListener("change", (event) => prepareImage(event.target.files[0], "body"));
  $("#delete-post").addEventListener("click", deletePost);
  form.addEventListener("submit", savePost);
  window.addEventListener("beforeunload", () => { state.token = ""; });
})();
