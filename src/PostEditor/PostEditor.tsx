import Editor, {
  BtnBold,
  BtnBulletList,
  BtnItalic,
  BtnLink,
  BtnNumberedList,
  BtnStrikeThrough,
  Toolbar
} from 'react-simple-wysiwyg'
import {memo, useCallback, useEffect, useState} from "react";

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

    useEffect(() => {
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

      // Слушатель для получения значений из React Native
      const handleMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'SET_VALUE' && data.value !== undefined) {
            // Конвертируем text в HTML если нужно
            const htmlValue = textToHtml(data.value)
            setValue(htmlValue)
          }
        } catch (error) {
          console.error('Error parsing message:', error)
        }
      }

      window.addEventListener('message', handleMessage)
      document.addEventListener('message', handleMessage as EventListener)

      return () => {
        window.removeEventListener('message', handleMessage)
        document.removeEventListener('message', handleMessage as EventListener)
      }
    }, [])

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

    const handleChange = (e: { target: { value: string } }) => {
      const newValue = e.target.value
      setValue(newValue)

      // Отправитель для отправки значений в React Native
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'VALUE_CHANGED',
          value: newValue
        }))
      }

      // Отправляем новую высоту сразу и через небольшую задержку
      sendHeight()
      setTimeout(sendHeight, 50)
    }

    return (
      <Editor value={value} onChange={handleChange}>
        <Toolbar>
          <BtnBold  />
          <BtnItalic />
          <BtnStrikeThrough/>
          <BtnBulletList/>
          <BtnNumberedList/>
          <BtnLink/>
        </Toolbar>
      </Editor>
    )
  }
)
