import { useEffect } from 'react'

type Locale = 'en' | 'es'
type TranslationMap = Record<string, { en: string; es: string }>

const STORAGE_KEY = 'cayad.services.locale'
const LANGUAGE_EVENT = 'cayad-language-change'
const textSources = new WeakMap<Text, string>()
const attributeSources = new WeakMap<HTMLElement, Record<string, string>>()
const translatableAttributes = ['aria-label', 'aria-description', 'alt', 'placeholder', 'title']
const skippedSelector = 'script, style, noscript, pre, code, textarea, [contenteditable="true"], [data-no-ui-translate], [data-user-content]'

const readLocale = (): Locale => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'es' ? 'es' : 'en'
  } catch {
    return 'en'
  }
}

const writeLocale = (locale: Locale) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Language preference is optional when storage is unavailable.
  }
}

const shouldSkip = (node: Text) => !node.parentElement || Boolean(node.parentElement.closest(skippedSelector))

const translateTextNode = (node: Text, translations: TranslationMap) => {
  if (shouldSkip(node)) return
  const currentValue = node.nodeValue || ''
  const currentText = currentValue.replace(/\s+/g, ' ').trim()
  if (!currentText) return
  const source = textSources.get(node) || currentText
  const translated = translations[source]?.es
  if (!translated || translated === currentText) return
  textSources.set(node, source)
  node.nodeValue = currentValue.replace(currentText, translated)
}

const translateAttributes = (element: Element, translations: TranslationMap) => {
  if (!(element instanceof HTMLElement) || element.closest(skippedSelector)) return
  const sources = attributeSources.get(element) || {}
  for (const attribute of translatableAttributes) {
    const currentValue: string | null = element.getAttribute(attribute)
    if (!currentValue) continue
    const source = sources[attribute] || currentValue
    const translated = translations[source]?.es
    if (!translated || translated === currentValue) continue
    sources[attribute] = source
    element.setAttribute(attribute, translated)
  }
  if (Object.keys(sources).length) attributeSources.set(element, sources)
}

const runInFrames = (items: ArrayLike<unknown>, callback: (item: any) => void, onComplete?: () => void) => {
  let index = 0
  let frame = 0
  const step = () => {
    const deadline = performance.now() + 7
    while (index < items.length && performance.now() < deadline) callback(items[index++])
    if (index < items.length) frame = window.requestAnimationFrame(step)
    else onComplete?.()
  }
  frame = window.requestAnimationFrame(step)
  return () => window.cancelAnimationFrame(frame)
}

const translateDocumentOnce = (translations: TranslationMap) => {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    nodes.push(node as Text)
    node = walker.nextNode()
  }

  const attributes = document.querySelectorAll('[aria-label], [aria-description], [alt], [placeholder], [title]')
  document.documentElement.lang = 'es'
  const title = translations[document.title]?.es
  if (title) document.title = title

  let cancelAttributes = () => {}
  const cancelText = runInFrames(nodes, (textNode) => translateTextNode(textNode, translations), () => {
    cancelAttributes = runInFrames(attributes, (element) => translateAttributes(element, translations))
  })
  return () => {
    cancelText()
    cancelAttributes()
  }
}

export default function SiteLanguageController () {
  useEffect(() => {
    let cancelled = false
    const cleanups: Array<() => void> = []

    const reloadForLocale = (locale: Locale) => {
      writeLocale(locale)
      // React islands are server-rendered in English. A single reload gives each
      // island a clean, stable render before the one-time Spanish pass runs.
      window.location.reload()
    }

    const handleLanguageChange = (event: Event) => {
      const locale = (event as CustomEvent<Locale>).detail
      if (locale === 'en' || locale === 'es') reloadForLocale(locale)
    }

    window.addEventListener(LANGUAGE_EVENT, handleLanguageChange)
    const locale = readLocale()
    document.documentElement.lang = locale

    if (locale === 'es') {
      void import('../i18n/uiTranslations.json').then(({ default: translations }) => {
        if (cancelled) return
        const run = () => cleanups.push(translateDocumentOnce(translations as TranslationMap))
        const begin = () => {
          // Wait until page resources and Astro's client islands have completed
          // their initial hydration. A second bounded pass catches late islands;
          // unlike the old MutationObserver, neither pass can loop.
          window.setTimeout(run, 1000)
          window.setTimeout(run, 4000)
        }
        if (document.readyState === 'complete') begin()
        else window.addEventListener('load', begin, { once: true })
      })
    }

    return () => {
      cancelled = true
      cleanups.forEach((cleanup) => cleanup())
      window.removeEventListener(LANGUAGE_EVENT, handleLanguageChange)
    }
  }, [])

  return null
}
