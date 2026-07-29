import { useEffect } from 'react'
import translations from '../i18n/uiTranslations.json'

type Locale = 'en' | 'es'

const STORAGE_KEY = 'cayad.services.locale'
const LANGUAGE_EVENT = 'cayad-language-change'
const textSources = new WeakMap<Text, string>()
const attributeSources = new WeakMap<HTMLElement, Record<string, string>>()
const translatableAttributes = ['aria-label', 'aria-description', 'alt', 'placeholder', 'title']

const getLocale = (): Locale => window.localStorage.getItem(STORAGE_KEY) === 'es' ? 'es' : 'en'

const shouldSkip = (node: Text) => !node.parentElement || Boolean(node.parentElement.closest(
  'script, style, noscript, pre, code, textarea, [contenteditable="true"], [data-no-ui-translate], [data-user-content]'
))

const translateTextNode = (node: Text, locale: Locale) => {
  if (shouldSkip(node)) return
  const currentValue = node.nodeValue || ''
  const currentText = currentValue.replace(/\s+/g, ' ').trim()
  const source = textSources.get(node) || currentText
  const translated = translations[source as keyof typeof translations]?.[locale]
  if (!translated || translated === currentText) return
  textSources.set(node, source)
  node.nodeValue = currentValue.replace(currentText, translated)
}

const translateAttributes = (element: Element, locale: Locale) => {
  if (!(element instanceof HTMLElement)) return
  const sources = attributeSources.get(element) || {}
  for (const attribute of translatableAttributes) {
    const currentValue = element.getAttribute(attribute)
    if (!currentValue) continue
    const source = sources[attribute] || currentValue
    const translated = translations[source as keyof typeof translations]?.[locale]
    if (!translated) continue
    sources[attribute] = source
    if (currentValue !== translated) element.setAttribute(attribute, translated)
  }
  if (Object.keys(sources).length) attributeSources.set(element, sources)
}

const applyTranslations = (locale: Locale) => {
  document.documentElement.lang = locale
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    translateTextNode(node as Text, locale)
    node = walker.nextNode()
  }
  document.querySelectorAll('[aria-label], [aria-description], [alt], [placeholder], [title]').forEach((element) => translateAttributes(element, locale))
}

export default function SiteLanguageController () {
  useEffect(() => {
    let locale = getLocale()
    let scheduled = false
    const update = (nextLocale = locale) => {
      locale = nextLocale
      window.localStorage.setItem(STORAGE_KEY, locale)
      applyTranslations(locale)
    }
    const schedule = () => {
      if (scheduled) return
      scheduled = true
      window.queueMicrotask(() => {
        scheduled = false
        applyTranslations(locale)
      })
    }
    const handleLanguageChange = (event: Event) => {
      const nextLocale = (event as CustomEvent<Locale>).detail
      if (nextLocale === 'en' || nextLocale === 'es') update(nextLocale)
    }

    update(locale)
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: translatableAttributes
    })
    window.addEventListener(LANGUAGE_EVENT, handleLanguageChange)
    return () => {
      observer.disconnect()
      window.removeEventListener(LANGUAGE_EVENT, handleLanguageChange)
    }
  }, [])

  return null
}
