import Editor, {
  BtnBold,
  BtnBulletList,
  BtnItalic,
  BtnLink,
  BtnNumberedList,
  BtnStrikeThrough,
  Toolbar
} from 'react-simple-wysiwyg'
import {memo, useEffect, useState} from "react";

// Объявление типа для React Native WebView
declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void
    }
  }
}


export const PostEditor = memo(() => {
    const [value, setValue] = useState("Hello, I’m Sergey Gol. I work as a Developer @Surn and have built my career navigating diverse environments, from Russia to Cyprus (Paphos and Limassol). I focus on practical, service-centered solutions and believe in thoughtful, respectful collaboration. Over the years I have:\n\n• Developed efficient code solutions in a dynamic industry\n• Adapted to multicultural settings to enhance team effectiveness\n• Refined my approach to problem-solving through real-world challenges\n\nI have accumulated substantial experience and am always ready to share insights from my journey. Your feedback is valuable to me as I continue growing and refining my craft.")

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
