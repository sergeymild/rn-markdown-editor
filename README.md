# PostEditor

A lightweight WYSIWYG rich text editor built with React and TypeScript, designed to work seamlessly with React Native WebView. Features bidirectional markdown conversion and real-time content synchronization.

## Overview

PostEditor is a web-based rich text editor that can be embedded in React Native applications via WebView. It provides a familiar text editing experience with support for common formatting options and automatic markdown conversion.

## Quick Start

```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Build for production
yarn build

# Build as bundle for React Native
yarn build:bundle
```

## Features

- Rich text formatting (bold, italic, strikethrough)
- Lists (bullet and numbered)
- Link insertion
- Markdown input/output
- GitHub Flavored Markdown support
- Automatic height adjustment for WebView
- Real-time content synchronization
- Plain text to HTML conversion

## Usage

For detailed integration instructions, examples, and API reference, see [USAGE.md](./USAGE.md).

### Production-Ready Component

Here's a complete, production-ready wrapper component with TypeScript support, promise-based API, and proper error handling:

```typescript
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import WebView from 'react-native-webview';

type Request = { resolve: (value: string) => void; reject: (error: Error) => void };

interface PostEditorProps {
  initialValue: string;
}

export interface PostEditorRef {
  currentValue: () => Promise<string>;
}

export const PostEditor = forwardRef<PostEditorRef, PostEditorProps>((props, ref) => {
  const requestIdCounter = useRef(0);
  const pendingRequests = useRef<Map<string, Request>>(new Map());
  const webviewRef = useRef<WebView>(null);
  const [webViewHeight, setWebViewHeight] = useState(300);
  const [isReady, setIsReady] = useState(false);
  const currentValue = useRef<string>(props.initialValue ?? '');

  const getValue = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const requestId = `req_${requestIdCounter.current++}`;
      pendingRequests.current.set(requestId, { resolve, reject });
      webviewRef.current?.postMessage(JSON.stringify({ type: 'GET_VALUE', requestId }));

      setTimeout(() => {
        if (pendingRequests.current.has(requestId)) {
          pendingRequests.current.delete(requestId);
          reject(new Error('Timeout waiting for value'));
        }
      }, 3000);
    });
  };

  useImperativeHandle(ref, () => ({ currentValue: getValue }), []);

  useEffect(() => {
    if (isReady && webviewRef.current) {
      webviewRef.current.postMessage(
        JSON.stringify({ type: 'SET_VALUE', value: props.initialValue })
      );
    }
  }, [isReady, props.initialValue]);

  return (
    <WebView
      ref={webviewRef}
      originWhitelist={['*']}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      style={{ height: webViewHeight }}
      source={require('./bundle.html')}
      onMessage={(event) => {
        const data = JSON.parse(event.nativeEvent.data);

        if (data.type === 'READY') {
          setIsReady(true);
        } else if (data.type === 'VALUE_CHANGED') {
          currentValue.current = data.value;
        } else if (data.type === 'HEIGHT_CHANGED') {
          setWebViewHeight(data.height);
        } else if (data.type === 'VALUE_RESPONSE') {
          const pending = pendingRequests.current.get(data.requestId);
          if (pending) {
            pending.resolve(data.value);
            pendingRequests.current.delete(data.requestId);
          }
        }
      }}
    />
  );
});
```

### Using the Component

```typescript
import React, { useRef } from 'react';
import { View, Button } from 'react-native';
import { PostEditor, PostEditorRef } from './PostEditor';

export default function MyScreen() {
  const editorRef = useRef<PostEditorRef>(null);

  const handleSave = async () => {
    try {
      const markdown = await editorRef.current?.currentValue();
      console.log('Content:', markdown);
      // Save to your backend
    } catch (error) {
      console.error('Failed to get content:', error);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <PostEditor
        ref={editorRef}
        initialValue="# Hello\n\nStart writing..."
      />
      <Button title="Save" onPress={handleSave} />
    </View>
  );
}
```

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **react-simple-wysiwyg** - Core editor component
- **unified/remark/rehype** - Markdown processing
- **remark-gfm** - GitHub Flavored Markdown

## Project Structure

```
editor/
├── src/
│   ├── App.tsx              # Main application component
│   ├── PostEditor/
│   │   ├── PostEditor.tsx   # Editor component with RN integration
│   │   └── markdown.tsx     # Markdown ↔ HTML conversion utilities
│   └── main.tsx            # Application entry point
├── package.json
└── vite.config.ts
```

## Development

The project uses Vite for fast development and HMR (Hot Module Replacement):

```bash
yarn dev
```

Open [http://localhost:5173](http://localhost:5173) to view the editor in your browser.

## Building

### Web Build
Creates an optimized production build:
```bash
yarn build
```

Output will be in the `dist/` directory.

### Bundle Build
Creates a single HTML file for embedding in React Native:
```bash
yarn build:bundle
```

## Scripts

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn build:bundle` - Build as single HTML bundle
- `yarn lint` - Run ESLint
- `yarn preview` - Preview production build

## React Native WebView Integration

The editor communicates with React Native using a postMessage-based protocol:

- **SET_VALUE** - Load content into editor (supports markdown, HTML, or plain text)
- **GET_VALUE** - Retrieve content as markdown
- **VALUE_CHANGED** - Real-time content updates
- **HEIGHT_CHANGED** - Dynamic height adjustment
- **READY** - Editor initialization complete

See [USAGE.md](./USAGE.md) for complete integration examples.

## Browser Support

Works in modern browsers and React Native WebView:
- iOS WebView
- Android WebView
- Chrome/Edge 90+
- Safari 14+
- Firefox 88+

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

MIT