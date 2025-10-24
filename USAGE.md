# PostEditor - WYSIWYG Rich Text Editor for React Native

A lightweight, embeddable WYSIWYG rich text editor built with React that runs inside React Native WebView. Features bidirectional markdown conversion and automatic height adjustment.

## Features

- **Rich Text Editing**: Bold, italic, strikethrough, bullet/numbered lists, and links
- **Markdown Support**: Automatic conversion between HTML and Markdown
- **React Native Integration**: Seamless communication via WebView postMessage API
- **Auto-sizing**: Automatically adjusts WebView height based on content
- **GitHub Flavored Markdown**: Full GFM support via remark-gfm

## Installation & Setup

### Prerequisites

```bash
# Install dependencies
yarn install
# or
npm install
```

### Development

```bash
# Start development server
yarn dev

# Build for production
yarn build

# Build as bundle (for React Native integration)
yarn build:bundle
```

## React Native Integration

### 1. Setup WebView

```typescript
import { WebView } from 'react-native-webview';
import { useRef, useState } from 'react';

function MyComponent() {
  const webViewRef = useRef<WebView>(null);
  const [editorReady, setEditorReady] = useState(false);

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: 'http://your-editor-url' }}
      // OR use local HTML file:
      // source={{ html: require('./editor.html') }}
      onMessage={(event) => {
        const data = JSON.parse(event.nativeEvent.data);
        // Handle messages from editor (see below)
      }}
    />
  );
}
```

### 2. Message Protocol

The editor communicates with React Native using a JSON-based message protocol.

#### Messages FROM Editor TO React Native

**Editor Ready**
```json
{
  "type": "READY"
}
```
Sent when the editor has loaded and is ready to receive commands.

**Value Changed**
```json
{
  "type": "VALUE_CHANGED",
  "value": "<p>HTML content</p>"
}
```
Sent whenever the user edits content. Value is in HTML format.

**Height Changed**
```json
{
  "type": "HEIGHT_CHANGED",
  "height": 450
}
```
Sent when content height changes. Use this to adjust WebView height dynamically.

**Value Response**
```json
{
  "type": "VALUE_RESPONSE",
  "requestId": "unique-id-123",
  "value": "**markdown** content"
}
```
Response to GET_VALUE request. Value is converted to Markdown format.

#### Messages FROM React Native TO Editor

**Set Value**
```typescript
webViewRef.current?.postMessage(JSON.stringify({
  type: 'SET_VALUE',
  value: '**Bold text** and _italic text_'
}));
```
Sets the editor content. Accepts Markdown, HTML, or plain text.

**Get Value**
```typescript
const requestId = Date.now().toString();
webViewRef.current?.postMessage(JSON.stringify({
  type: 'GET_VALUE',
  requestId: requestId
}));
```
Requests current content in Markdown format. Response includes the requestId.

### 3. Basic Example

```typescript
import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export default function EditorScreen() {
  const webViewRef = useRef<WebView>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [editorHeight, setEditorHeight] = useState(300);

  useEffect(() => {
    // Set initial content once editor is ready
    if (editorReady) {
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'SET_VALUE',
        value: '# Welcome\n\nStart editing your **content** here!'
      }));
    }
  }, [editorReady]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case 'READY':
          setEditorReady(true);
          break;

        case 'HEIGHT_CHANGED':
          setEditorHeight(data.height);
          break;

        case 'VALUE_CHANGED':
          console.log('Content changed:', data.value);
          // Save to state or database
          break;

        case 'VALUE_RESPONSE':
          console.log('Current markdown:', data.value);
          // Use the markdown value
          break;
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  };

  const saveContent = () => {
    const requestId = Date.now().toString();
    webViewRef.current?.postMessage(JSON.stringify({
      type: 'GET_VALUE',
      requestId: requestId
    }));
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: 'http://localhost:5173' }}
        onMessage={handleMessage}
        style={{ height: editorHeight }}
        scrollEnabled={false}
        javaScriptEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
```

### 4. Production-Ready Component with Promise API

This is a complete, production-ready implementation with proper TypeScript types, promise-based API, custom font injection, and request timeout handling.

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

// Custom font injection (optional)
const FONT_INJECTION_SCRIPT = `
  (function() {
    // Apply Montserrat font to all elements
    const style = document.createElement('style');
    style.textContent = \`
      body, * {
        font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }
    \`;
    document.head.appendChild(style);
  })();
  true;
`;

export const PostEditor = forwardRef<PostEditorRef, PostEditorProps>((props, ref) => {
  const requestIdCounter = useRef(0);
  const pendingRequests = useRef<Map<string, Request> | null>(null);

  if (!pendingRequests.current) {
    pendingRequests.current = new Map<string, Request>();
  }

  const webviewRef = useRef<WebView>(null);
  const [webViewHeight, setWebViewHeight] = useState(300);
  const [isReady, setIsReady] = useState(false);
  const currentValue = useRef<string>(props.initialValue ?? '');

  // Promise-based API to get current editor value
  const getValue = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const requestId = `req_${requestIdCounter.current++}`;

      // Store the promise callbacks
      pendingRequests.current?.set(requestId, { resolve, reject });

      // Send GET_VALUE request
      webviewRef.current?.postMessage(
        JSON.stringify({ type: 'GET_VALUE', requestId })
      );

      // Timeout after 3 seconds
      setTimeout(() => {
        if (pendingRequests.current?.has(requestId)) {
          pendingRequests.current?.delete(requestId);
          reject(new Error('Timeout waiting for value'));
        }
      }, 3000);
    });
  };

  // Expose API through ref
  useImperativeHandle(ref, () => ({ currentValue: getValue }), []);

  // Set initial value when editor is ready
  useEffect(() => {
    if (isReady && webviewRef.current) {
      currentValue.current = props.initialValue;
      webviewRef.current.postMessage(
        JSON.stringify({
          type: 'SET_VALUE',
          value: props.initialValue,
        })
      );
    }
  }, [isReady, props.initialValue]);

  return (
    <WebView
      ref={webviewRef}
      originWhitelist={['*']}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      injectedJavaScriptBeforeContentLoaded={FONT_INJECTION_SCRIPT}
      style={{ height: webViewHeight }}
      source={require('./bundle.html')} // Use local bundle
      // source={{ uri: 'http://localhost:5173' }} // Or use dev server
      onMessage={(event) => {
        const data = JSON.parse(event.nativeEvent.data);

        if (data.type === 'READY') {
          setIsReady(true);
        } else if (data.type === 'VALUE_CHANGED') {
          // Track current value
          currentValue.current = data.value;
        } else if (data.type === 'HEIGHT_CHANGED') {
          setWebViewHeight(data.height);
        } else if (data.type === 'VALUE_RESPONSE') {
          // Resolve the promise with the value
          const pending = pendingRequests.current?.get(data.requestId);
          if (pending) {
            pending.resolve(data.value);
            pendingRequests.current?.delete(data.requestId);
          }
        }
      }}
    />
  );
});

PostEditor.displayName = 'PostEditor';
```

#### Usage of Production Component

```typescript
import React, { useRef } from 'react';
import { View, Button, Alert } from 'react-native';
import { PostEditor, PostEditorRef } from './PostEditor';

export default function MyScreen() {
  const editorRef = useRef<PostEditorRef>(null);

  const handleSave = async () => {
    try {
      const markdown = await editorRef.current?.currentValue();
      console.log('Saved content:', markdown);
      // Save to database or API
    } catch (error) {
      Alert.alert('Error', 'Failed to get editor content');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <PostEditor
        ref={editorRef}
        initialValue="# Hello World\n\nStart writing..."
      />
      <Button title="Save" onPress={handleSave} />
    </View>
  );
}
```

#### Key Features of Production Component

- **Promise-based API**: Use `await editorRef.current?.currentValue()` to get content
- **Request Timeout**: Automatically rejects after 3 seconds if no response
- **Proper Cleanup**: Manages pending requests in a Map
- **Custom Font Injection**: Inject custom CSS before content loads
- **Local Bundle**: Uses `require('./bundle.html')` for offline support
- **TypeScript Types**: Full type safety with proper interfaces
- **forwardRef**: Clean API exposed through ref
- **Auto Height**: Dynamically adjusts to content size

## Advanced Customization

### Custom Font Injection

You can inject custom CSS to style the editor content. Use the `injectedJavaScriptBeforeContentLoaded` prop:

```typescript
const CUSTOM_STYLE_SCRIPT = `
  (function() {
    const style = document.createElement('style');
    style.textContent = \`
      body, * {
        font-family: 'YourFont', -apple-system, sans-serif !important;
        font-size: 16px;
        color: #333;
      }

      /* Style editor toolbar */
      .rsw-toolbar {
        background: #f5f5f5;
        border-radius: 8px;
      }

      /* Style editor content */
      .rsw-ce {
        padding: 16px;
        min-height: 200px;
      }
    \`;
    document.head.appendChild(style);
  })();
  true;
`;

<WebView
  injectedJavaScriptBeforeContentLoaded={CUSTOM_STYLE_SCRIPT}
  // ... other props
/>
```

### Dynamic Height Management

The editor automatically reports height changes, but you may need to handle edge cases:

```typescript
const [webViewHeight, setWebViewHeight] = useState(300);
const minHeight = 200;
const maxHeight = 600;

// In onMessage handler:
if (data.type === 'HEIGHT_CHANGED') {
  // Clamp height between min and max
  const newHeight = Math.min(Math.max(data.height, minHeight), maxHeight);
  setWebViewHeight(newHeight);
}
```

### Error Handling Best Practices

```typescript
const getValue = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!webviewRef.current) {
      reject(new Error('WebView ref is not available'));
      return;
    }

    const requestId = `req_${Date.now()}`;
    pendingRequests.current.set(requestId, { resolve, reject });

    webviewRef.current.postMessage(
      JSON.stringify({ type: 'GET_VALUE', requestId })
    );

    // Configurable timeout
    const TIMEOUT_MS = 3000;
    setTimeout(() => {
      if (pendingRequests.current.has(requestId)) {
        pendingRequests.current.delete(requestId);
        reject(new Error(`Request timeout after ${TIMEOUT_MS}ms`));
      }
    }, TIMEOUT_MS);
  });
};
```

## Available Formatting Options

The editor provides the following formatting toolbar buttons:

- **Bold**: `Ctrl/Cmd + B`
- **Italic**: `Ctrl/Cmd + I`
- **Strikethrough**: Text with line through it
- **Bullet List**: Unordered list
- **Numbered List**: Ordered list
- **Link**: Insert hyperlinks

## Content Conversion

### Markdown to HTML
Automatically converts markdown syntax to HTML for editing:
```markdown
**bold** → <strong>bold</strong>
_italic_ → <em>italic</em>
# Header → <h1>Header</h1>
```

### HTML to Markdown
Converts editor HTML back to markdown when requested:
```html
<strong>bold</strong> → **bold**
<em>italic</em> → *italic*
<h1>Header</h1> → # Header
```

### Plain Text Support
If you send plain text without markdown or HTML, it will be converted to HTML paragraphs automatically.

## Building for Production

### Option 1: Hosted Version
Build and host on a web server:
```bash
yarn build
# Deploy the dist/ folder to your web server
```

### Option 2: Bundle with React Native
Build as a single HTML file:
```bash
yarn build:bundle
# Include the generated bundle in your React Native app assets
```

Then in React Native:
```typescript
<WebView
  source={{ html: require('./assets/editor.html') }}
  // ... other props
/>
```

## Technical Details

### Dependencies
- **react-simple-wysiwyg**: Core WYSIWYG editor component
- **unified/remark/rehype**: Markdown/HTML processing pipeline
- **remark-gfm**: GitHub Flavored Markdown support

### Browser Compatibility
Requires modern browser with ES6+ support. Works in:
- React Native WebView (iOS/Android)
- Modern mobile browsers
- Desktop browsers (Chrome, Firefox, Safari, Edge)

## Troubleshooting

### Editor not loading
- Check that WebView has `javaScriptEnabled={true}`
- Verify the source URL or HTML is correct
- Check console for errors using remote debugging

### Height not updating
- Ensure you're listening for HEIGHT_CHANGED messages
- Update WebView height in state when message received
- Set `scrollEnabled={false}` on WebView

### Content not saving
- Make sure to use GET_VALUE to retrieve markdown content
- Listen for VALUE_RESPONSE with matching requestId
- Handle VALUE_CHANGED events for real-time updates

### Markdown conversion issues
- The editor uses GitHub Flavored Markdown (GFM)
- Complex HTML may not convert perfectly to markdown
- Check console for conversion errors

## API Reference

### Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `READY` | Editor → RN | Editor initialized and ready |
| `SET_VALUE` | RN → Editor | Set editor content (markdown/HTML) |
| `GET_VALUE` | RN → Editor | Request current content as markdown |
| `VALUE_RESPONSE` | Editor → RN | Response with markdown content |
| `VALUE_CHANGED` | Editor → RN | Content was edited (HTML format) |
| `HEIGHT_CHANGED` | Editor → RN | Content height changed |

## License

MIT