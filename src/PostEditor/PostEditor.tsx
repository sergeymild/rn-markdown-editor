import Editor, {
  Toolbar
} from 'react-simple-wysiwyg'
import {memo, useCallback, useEffect, useRef, useState} from "react";
import {markdownToHtml, htmlToMarkdown} from "./markdown.tsx";

// Объявление типа для React Native WebView
declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void
    }
  }
}


export const PostEditor = memo(() => {
    const [value, setValue] = useState('')
    const hasSentCaretPosition = useRef(false)

    // Отправляем сообщение о готовности при монтировании компонента
    useEffect(() => {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'READY'
        }))
      }
    }, [])

    useEffect(() => {
      // Функция для очистки HTML от ненужных стилей и тегов
      const cleanHtml = (html: string): string => {
        const temp = document.createElement('div')
        temp.innerHTML = html

        // Удаляем все style атрибуты
        const elementsWithStyle = temp.querySelectorAll('[style]')
        elementsWithStyle.forEach(el => el.removeAttribute('style'))

        // Удаляем ненужные атрибуты (class, id, color, face и т.д.)
        const allElements = temp.querySelectorAll('*')
        allElements.forEach(el => {
          const attrs = Array.from(el.attributes)
          attrs.forEach(attr => {
            if (!['href', 'target'].includes(attr.name)) {
              el.removeAttribute(attr.name)
            }
          })
        })

        // Заменяем font теги на span без стилей
        const fontTags = temp.querySelectorAll('font')
        fontTags.forEach(font => {
          const span = document.createElement('span')
          span.innerHTML = font.innerHTML
          font.replaceWith(span)
        })

        // Удаляем ненужные теги, оставляя только их содержимое
        const tagsToRemove = ['span', 'div', 'section', 'article', 'u']
        tagsToRemove.forEach(tagName => {
          const tags = temp.querySelectorAll(tagName)
          tags.forEach(tag => {
            const parent = tag.parentNode
            while (tag.firstChild) {
              parent?.insertBefore(tag.firstChild, tag)
            }
            tag.remove()
          })
        })

        return temp.innerHTML
      }

      // Обработчик события вставки
      const handlePaste = (e: ClipboardEvent) => {
        e.preventDefault()

        const clipboardData = e.clipboardData
        if (!clipboardData) return

        // Получаем HTML или plain text из буфера обмена
        let pastedContent = clipboardData.getData('text/html')

        if (!pastedContent) {
          // Если HTML нет, используем plain text
          pastedContent = clipboardData.getData('text/plain')
          // Конвертируем переносы строк в <br>
          pastedContent = pastedContent.replace(/\n/g, '<br>')
        } else {
          // Очищаем HTML от стилей
          pastedContent = cleanHtml(pastedContent)
        }

        // Вставляем очищенный контент
        document.execCommand('insertHTML', false, pastedContent)
      }

      // Функция для конвертации plain text в HTML
      const textToHtml = (text: string): string => {
        // Если текст уже содержит HTML теги, возвращаем как есть
        if (/<[a-z][\s\S]*>/i.test(text)) {
          return text
        }

        // Конвертируем plain text в HTML с параграфами
        return text
          .split('\n\n')
          .map(paragraph => {
            const lines = paragraph.split('\n').filter(line => line.trim())
            if (lines.length === 0) return ''
            if (lines.length === 1) {
              return `<p>${lines[0]}</p>`
            }
            // Если строки начинаются с маркеров списка
            const listItems = lines.map(line => line.trim())
            if (listItems.some(line => line.startsWith('•') || line.startsWith('-') || /^\d+\./.test(line))) {
              return `<ul>${listItems.map(item => `<li>${item.replace(/^[•-]\s*/, '').replace(/^\d+\.\s*/, '')}</li>`).join('')}</ul>`
            }
            return `<p>${listItems.join('<br>')}</p>`
          })
          .filter(p => p)
          .join('')
      }

      const handleCommand = (command: string) => {
        if (command === 'link') {
          // Special handling for link command
          const selection = window.getSelection()
          const selectedText = selection?.toString()

          // Prompt for URL
          const url = window.prompt('Enter URL:', 'https://')

          if (url) {
            if (selectedText) {
              // If text is selected, create a link with that text
              document.execCommand('createLink', false, url)
            } else {
              // If no text is selected, insert the URL as both text and link
              document.execCommand(
                'insertHTML',
                false,
                `<a href="${url}">${url}</a>`,
              )
            }
          }
        } else {
          // For all other commands, execute normally
          document.execCommand(command, false)
        }
      }

      // Слушатель для получения значений из React Native
      const handleMessage = async (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'SET_VALUE' && data.value !== undefined) {
            // Конвертируем text в HTML если нужно
            const htmlValue = textToHtml(await markdownToHtml(data.value))
            setValue(htmlValue)
          } else if (data.type === 'GET_VALUE') {
            // Получаем текущее значение, конвертируем в markdown и отправляем обратно
            const markdown = await htmlToMarkdown(value)
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'VALUE_RESPONSE',
                requestId: data.requestId,
                value: markdown
              }))
            }
          } else if (data.type === 'EXECUTE_COMMAND' && data.command) {
              handleCommand(data.command)
          }
        } catch (error) {
          console.error('Error parsing message:', error)
        }
      }

      window.addEventListener('message', handleMessage as unknown as EventListener)
      document.addEventListener('message', handleMessage as unknown as EventListener)
      document.addEventListener('paste', handlePaste as unknown as EventListener)

      return () => {
        window.removeEventListener('message', handleMessage as unknown as EventListener)
        document.removeEventListener('message', handleMessage as unknown as EventListener)
        document.removeEventListener('paste', handlePaste as unknown as EventListener)
      }
    }, [value])

    const sendHeight = useCallback(() => {
      // Отправляем высоту контента в React Native
      if (window.ReactNativeWebView) {
        // Используем offsetHeight вместо scrollHeight для точного измерения
        const rootElement = document.getElementById('root')
        const height = rootElement ? rootElement.scrollHeight : document.documentElement.scrollHeight
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'HEIGHT_CHANGED',
          height: height
        }))
      }
    }, [])

    const getCaretPosition = useCallback(() => {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        return null
      }

      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right
      }
    }, [])

    // Отслеживаем изменения размера контента
    useEffect(() => {
      setTimeout(sendHeight, 100)
      const rootElement = document.getElementById('root')
      if (!rootElement) return

      const observer = new ResizeObserver(() => {
        sendHeight()
      })

      observer.observe(rootElement)

      return () => {
        observer.disconnect()
      }
    }, [sendHeight])

    // Отправляем позицию каретки при первом фокусе
    useEffect(() => {
      const handleFocus = () => {
        if (hasSentCaretPosition.current) return

        // Небольшая задержка, чтобы каретка успела установиться
        setTimeout(() => {
          const position = getCaretPosition()
          if (position && window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'CARET_POSITION',
              position
            }))
            hasSentCaretPosition.current = true
          }
        }, 500)
      }

      const handleBlur = () => {
        hasSentCaretPosition.current = false
      }

      const editor = document.querySelector('.rsw-editor')
      if (editor) {
        editor.addEventListener('focusin', handleFocus)
        editor.addEventListener('focusout', handleBlur)
        return () => {
          editor.removeEventListener('focusin', handleFocus)
          editor.removeEventListener('focusout', handleBlur)
        }
      }
    }, [getCaretPosition])

    const handleChange = (e: { target: { value: string } }) => {
      let newValue = e.target.value

      // Удаляем теги <u> во время редактирования
      if (newValue.includes('<u>')) {
        const temp = document.createElement('div')
        temp.innerHTML = newValue
        const uTags = temp.querySelectorAll('u')
        uTags.forEach(tag => {
          const parent = tag.parentNode
          while (tag.firstChild) {
            parent?.insertBefore(tag.firstChild, tag)
          }
          tag.remove()
        })
        newValue = temp.innerHTML
      }

      setValue(newValue)

      // Отправитель для отправки значений в React Native
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'VALUE_CHANGED',
          value: document.querySelector('.rsw-editor')?.textContent || ''
        }))
      }

      // Отправляем новую высоту сразу и через небольшую задержку
      sendHeight()
      setTimeout(sendHeight, 50)
    }

    return (
      <Editor value={value} onChange={handleChange}>
        <Toolbar>

        </Toolbar>
      </Editor>
    )
  }
)
