import base64
import json
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:4321"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on("pageerror", lambda error: errors.append(f"page:{error}"))

    page.goto(f"{BASE}/blog/", wait_until="networkidle")
    assert page.locator(".hero h1").inner_text().startswith("Practical routes")
    assert page.locator(".post-card").count() == 2
    page.get_by_role("button", name="Texas").click()
    assert page.locator(".post-card:visible").count() == 1
    page.locator("#blog-search").fill("no-result-topic")
    assert page.locator("#empty-state").is_visible()
    page.screenshot(path="/tmp/cayad-blog-desktop.png", full_page=True)

    page.goto(f"{BASE}/blog/florida-car-shipping-guide/", wait_until="networkidle")
    assert "Florida" in page.locator(".article-head h1").inner_text()
    assert page.locator('script[type="application/ld+json"]').count() == 1
    assert page.locator('link[rel="canonical"]').get_attribute("href").endswith("/blog/florida-car-shipping-guide/")
    assert "florida-car-shipping-guide" in page.locator('.blog-share a[aria-label="Share on Facebook"]').get_attribute("href")

    mobile = browser.new_page(viewport={"width": 390, "height": 844})
    mobile.goto(f"{BASE}/blog/", wait_until="networkidle")
    assert mobile.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1")
    mobile.screenshot(path="/tmp/cayad-blog-mobile.png", full_page=True)

    admin = browser.new_page(viewport={"width": 1440, "height": 900})
    admin.goto(f"{BASE}/admin/index.html", wait_until="networkidle")
    assert admin.locator(".login-card h1").is_visible()
    assert "organic reach" in admin.locator(".login-card h1").inner_text()
    assert admin.locator("#token").get_attribute("type") == "password"
    admin.locator("#toggle-token").click()
    assert admin.locator("#token").get_attribute("type") == "text"
    admin.screenshot(path="/tmp/cayad-blog-admin.png", full_page=True)

    mock_admin = browser.new_page(viewport={"width": 1440, "height": 900})
    sample_post = """---
title: \"Mock Florida Guide\"
excerpt: \"A mocked article used to verify the editor.\"
publishedAt: \"2026-08-01\"
author: \"Cayad Auto Transport\"
state: \"Florida\"
tags: [\"Florida\", \"Testing\"]
coverImage: \"/img/open-car.webp\"
coverAlt: \"Cars on a carrier\"
featured: false
draft: false
---

Mock article body.
"""

    def github_mock(route):
        path = route.request.url.split("api.github.com", 1)[-1]
        if path == "/user":
            payload = {"login": "cayad-editor", "name": "Cayad Editor", "avatar_url": "https://example.com/avatar.png"}
        elif path == "/repos/cayadservices/CayadServices":
            payload = {"full_name": "cayadservices/CayadServices"}
        elif path.startswith("/repos/cayadservices/CayadServices/contents/src/content/blog?"):
            payload = [{"name": "mock-florida-guide.md", "path": "src/content/blog/mock-florida-guide.md", "sha": "abc123"}]
        elif path.startswith("/repos/cayadservices/CayadServices/contents/src/content/blog/mock-florida-guide.md?"):
            payload = {"content": base64.b64encode(sample_post.encode()).decode()}
        elif route.request.method in ("PUT", "DELETE"):
            payload = {"content": {"sha": "new-sha"}}
        else:
            payload = {}
        route.fulfill(status=200, content_type="application/json", body=json.dumps(payload))

    mock_admin.route("https://api.github.com/**", github_mock)
    mock_admin.goto(f"{BASE}/admin/index.html", wait_until="networkidle")
    mock_admin.locator("#token").fill("mock-token")
    mock_admin.locator("#login-form").evaluate("form => form.requestSubmit()")
    mock_admin.locator(".post-row").wait_for()
    assert mock_admin.locator(".post-row").count() == 1
    mock_admin.locator("#new-post").click()
    mock_admin.locator("#title").fill("California Auto Transport Guide")
    assert mock_admin.locator("#slug").input_value() == "california-auto-transport-guide"
    mock_admin.locator("#excerpt").fill("A useful local guide for shipping a vehicle to and from California.")
    mock_admin.locator("#body").fill("California routes are busy year-round.\n\n## Plan your shipment\n\nBook early.")
    mock_admin.locator('input[name="state"]').fill("California")
    mock_admin.locator("#coverImage").evaluate("el => el.value = '/img/open-car.webp'")
    mock_admin.locator('input[name="coverAlt"]').fill("Vehicles on an open carrier")
    mock_admin.locator("#editor-form").evaluate("form => form.requestSubmit()")
    mock_admin.locator("#toast.show").wait_for()
    assert "published" in mock_admin.locator("#toast").inner_text().lower()

    assert not errors, "Browser errors: " + " | ".join(errors)
    browser.close()
    print("Blog UI checks passed. Screenshots saved in /tmp/cayad-blog-*.png")
