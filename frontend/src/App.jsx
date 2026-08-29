import { useState, useEffect, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

const API_BASE = 'http://localhost:8080/api'

function App() {
  const [user, setUser] = useState(null)
  const [isRegisterMode, setIsRegisterMode] = useState(false)

  // Auth Form State
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [authError, setAuthError] = useState(null)

  // Chat State
  const [targetUserId, setTargetUserId] = useState('')
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [isConnectedWs, setIsConnectedWs] = useState(false)

  const stompClientRef = useRef(null)

  // Kết nối và Lắng nghe WebSocket theo phòng chat
  useEffect(() => {
    if (!conversationId) return

    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        setIsConnectedWs(true)
        console.log('WebSocket đã kết nối thành công!')

        // Subscribe lắng nghe tin nhắn realtime từ backend phát về
        client.subscribe(`/topic/conversations/${conversationId}`, (message) => {
          const newMsg = JSON.parse(message.body)
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        })
      },
      onDisconnect: () => {
        setIsConnectedWs(false)
      },
      onStompError: (frame) => {
        console.error('Lỗi STOMP: ', frame)
      }
    })

    client.activate()
    stompClientRef.current = client

    return () => {
      if (client) {
        client.deactivate()
      }
    }
  }, [conversationId])

  // 1. Xử lý Đăng nhập / Đăng ký
  const handleAuth = async (e) => {
    e.preventDefault()
    setAuthError(null)
    const endpoint = isRegisterMode ? '/auth/register' : '/auth/login'
    const payload = isRegisterMode 
      ? { username, password, displayName } 
      : { username, password }

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error(await res.text() || 'Xác thực thất bại')
      const data = await res.json()
      setUser(data)
    } catch (err) {
      setAuthError(err.message)
    }
  }

  // 2. Mở hoặc tạo phòng chat 1-1
  const handleStartChat = async (e) => {
    e.preventDefault()
    if (!targetUserId) return

    try {
      const res = await fetch(`${API_BASE}/chat/conversations/direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user1Id: user.id, user2Id: Number(targetUserId) })
      })
      if (!res.ok) throw new Error('Không tạo được phòng chat')
      const conv = await res.json()
      setConversationId(conv.id)
      fetchMessages(conv.id)
    } catch (err) {
      alert(err.message)
    }
  }

  // 3. Lấy lịch sử chat ban đầu qua REST
  const fetchMessages = async (convId) => {
    try {
      const res = await fetch(`${API_BASE}/chat/conversations/${convId}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // 4. Gửi tin nhắn
  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!messageInput.trim() || !conversationId) return

    const content = messageInput
    setMessageInput('') // Xóa input ngay lập tức

    try {
      await fetch(`${API_BASE}/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversationId,
          senderId: user.id,
          content: content
        })
      })
    } catch (err) {
      console.error(err)
    }
  }

  // Giao diện Đăng nhập / Đăng ký
  if (!user) {
    return (
      <div style={{ maxWidth: 360, margin: '50px auto', padding: 24, border: '1px solid #444', borderRadius: 8 }}>
        <h2>{isRegisterMode ? 'Đăng ký tài khoản' : 'Đăng nhập'}</h2>
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input 
            placeholder="Username" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            required 
            style={{ padding: 8 }}
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
            style={{ padding: 8 }}
          />
          {isRegisterMode && (
            <input 
              placeholder="Display Name" 
              value={displayName} 
              onChange={e => setDisplayName(e.target.value)} 
              style={{ padding: 8 }}
            />
          )}
          <button type="submit" style={{ padding: 10, cursor: 'pointer' }}>
            {isRegisterMode ? 'Tạo tài khoản' : 'Đăng nhập'}
          </button>
        </form>

        {authError && <p style={{ color: 'red', marginTop: 10 }}>{authError}</p>}

        <p style={{ marginTop: 16, cursor: 'pointer', color: '#646cff' }} onClick={() => setIsRegisterMode(!isRegisterMode)}>
          {isRegisterMode ? 'Đã có tài khoản? Đăng nhập ngay' : 'Chưa có tài khoản? Đăng ký'}
        </p>
      </div>
    )
  }

  // Giao diện Chat Room
  return (
    <div style={{ maxWidth: 800, margin: '20px auto', padding: 20, border: '1px solid #444', borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #444', paddingBottom: 10 }}>
        <h3>Xin chào: {user.displayName} (ID: {user.id})</h3>
        <button onClick={() => { setUser(null); setConversationId(null); }} style={{ padding: '6px 12px' }}>
          Đăng xuất
        </button>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
        <input 
          placeholder="Nhập User ID đối phương (vd: 1 hoặc 2)" 
          value={targetUserId} 
          onChange={e => setTargetUserId(e.target.value)} 
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleStartChat} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          Mở chat
        </button>
      </div>

      {conversationId && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h4>
              Phòng Chat ID: {conversationId} {' '}
              <span style={{ color: isConnectedWs ? '#4ade80' : '#f87171', fontSize: 13 }}>
                ● {isConnectedWs ? 'Realtime Connected' : 'Connecting WebSocket...'}
              </span>
            </h4>
          </div>

          <div style={{ height: 320, overflowY: 'auto', border: '1px solid #333', padding: 12, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.map(msg => (
              <div 
                key={msg.id} 
                style={{ 
                  alignSelf: msg.senderId === user.id ? 'flex-end' : 'flex-start',
                  background: msg.senderId === user.id ? '#1e3a8a' : '#374151',
                  padding: '8px 12px',
                  borderRadius: 8,
                  maxWidth: '70%'
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.7 }}>{msg.senderName}</div>
                <div>{msg.content}</div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendMessage} style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <input 
              placeholder="Nhập nội dung tin nhắn và bấm Gửi..." 
              value={messageInput} 
              onChange={e => setMessageInput(e.target.value)} 
              style={{ flex: 1, padding: 8 }}
            />
            <button type="submit" style={{ padding: '8px 16px', cursor: 'pointer' }}>Gửi</button>
          </form>
        </div>
      )}
    </div>
  )
}

export default App