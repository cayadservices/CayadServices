#!/usr/bin/env node

/* Generates translations exclusively from static public-site source text. */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'

const traverse = traverseModule.default
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDirectory = path.join(root, 'src')
const outputFile = path.join(root, 'src', 'i18n', 'uiTranslations.json')
const textAttributes = new Set(['label', 'placeholder', 'title', 'helperText', 'aria-label', 'aria-description', 'alt'])
const objectTextProperties = new Set(['label', 'placeholder', 'title', 'helperText', 'description', 'text', 'emptyText', 'noOptionsText', 'loadingText', 'message', 'detail', 'error'])

const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim()
const isVisibleText = (value) => {
  const text = normalize(value)
  if (text.length < 2 || text.length > 800 || !/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(text)) return false
  if (/^(https?:|\/|#|[\w.-]+@[\w.-]+\.[A-Za-z]{2,}|[A-Z_][A-Z0-9_]*$)/.test(text)) return false
  if (/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|application\/|America\/)/.test(text)) return false
  return true
}
const isSpanish = (value) => /[áéíóúüñ¿¡]|\b(el|la|los|las|de|del|para|con|sin|guardar|cancelar|editar|eliminar|crear|actualizar|cerrar|sesión|tarea|orden|cotización|cliente|transportista|configuración|correo|mensaje|éxito|sí|modo|claro|oscuro|tienes|debes|resolver|atrasadas|antes|continuar|navegar|selecciona|seleccionar|búsqueda|buscar|inicio|fin|información|enviar|enviado|asignado|asignar|confirmar|vista|visto|contrato|vehículo|vehículos|disponible|disponibles|asegúrate|publicada|primero|ahora|todos|todas|ningún|ninguna|hola|quiero|transportar|coche)\b/i.test(value)

async function collectFiles (directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectFiles(target))
    else if (/\.(astro|ts|tsx)$/.test(entry.name)) files.push(target)
  }
  return files
}
const add = (values, value) => {
  const text = normalize(value)
  if (isVisibleText(text)) values.add(text)
}
const isToastCall = (node) => node?.type === 'MemberExpression' && ['error', 'success', 'warning', 'info', 'fire'].includes(node.property?.name)

function collectTsx (source, values) {
  const ast = parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript', 'dynamicImport', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator'] })
  traverse(ast, {
    JSXText (nodePath) { add(values, nodePath.node.value) },
    JSXAttribute (nodePath) {
      if (textAttributes.has(nodePath.node.name?.name) && nodePath.node.value?.type === 'StringLiteral') add(values, nodePath.node.value.value)
    },
    ObjectProperty (nodePath) {
      const key = nodePath.node.key?.name || nodePath.node.key?.value
      if (objectTextProperties.has(key) && nodePath.node.value?.type === 'StringLiteral') add(values, nodePath.node.value.value)
    },
    CallExpression (nodePath) {
      if (!isToastCall(nodePath.node.callee) || nodePath.node.arguments[0]?.type !== 'StringLiteral') return
      add(values, nodePath.node.arguments[0].value)
    }
  })
}

function collectAstro (source, values) {
  const body = source.replace(/^---[\s\S]*?---/, '')
  for (const match of body.matchAll(/>([^<>{}]{2,800})</g)) add(values, match[1])
  for (const match of body.matchAll(/(?:title|alt|placeholder|aria-label)\s*=\s*["']([^"']{2,800})["']/g)) add(values, match[1])
  for (const match of body.matchAll(/(?:title|content)\s*=\s*["']([^"']{2,800})["']/g)) add(values, match[1])
}

function chunks (texts, maxLength = 3600) {
  const output = []
  let current = []; let length = 0
  for (const text of texts) {
    if (current.length && length + text.length + 1 > maxLength) { output.push(current); current = []; length = 0 }
    current.push(text); length += text.length + 1
  }
  if (current.length) output.push(current)
  return output
}
async function translateGroup (texts, sourceLanguage, targetLanguage) {
  const result = new Map()
  for (const group of chunks(texts)) {
    const query = new URLSearchParams({ client: 'gtx', sl: sourceLanguage, tl: targetLanguage, dt: 't', q: group.join('\n') })
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${query}`)
    if (!response.ok) throw new Error(`Translation request failed: ${response.status}`)
    const payload = await response.json()
    const translated = payload[0].map((part) => part[0]).join('').split('\n').map(normalize)
    if (translated.length !== group.length) throw new Error('Translation response did not preserve the catalog line count')
    group.forEach((text, index) => result.set(text, translated[index] || text))
    process.stdout.write(`Translated ${result.size}/${texts.length} ${sourceLanguage}->${targetLanguage}\r`)
  }
  process.stdout.write('\n')
  return result
}

const values = new Set()
for (const filename of await collectFiles(sourceDirectory)) {
  try {
    const source = await fs.readFile(filename, 'utf8')
    if (filename.endsWith('.astro')) collectAstro(source, values)
    else collectTsx(source, values)
  } catch (error) { console.warn(`Skipping ${path.relative(root, filename)}: ${error.message}`) }
}
const texts = [...values].sort((a, b) => a.localeCompare(b))
const spanish = texts.filter(isSpanish)
const english = texts.filter((text) => !isSpanish(text))
const [englishToSpanish, spanishToEnglish] = await Promise.all([
  translateGroup(english, 'en', 'es'),
  translateGroup(spanish, 'es', 'en')
])
const catalog = Object.fromEntries(texts.map((text) => [text, {
  en: englishToSpanish.has(text) ? text : spanishToEnglish.get(text),
  es: englishToSpanish.has(text) ? englishToSpanish.get(text) : text
}]))
await fs.mkdir(path.dirname(outputFile), { recursive: true })
await fs.writeFile(outputFile, `${JSON.stringify(catalog, null, 2)}\n`)
console.log(`Wrote ${texts.length} UI translations to ${path.relative(root, outputFile)}`)
