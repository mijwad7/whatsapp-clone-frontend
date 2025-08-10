import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

function App() {
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [userInfo, setUserInfo] = useState({ name: '', number: '' });
  const ws = useRef(null);
  const messagesEndRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Format date for conversation list and message separators
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Group messages by date for separators
  const groupMessagesByDate = (messages) => {
    const grouped = [];
    let currentDate = null;
    
    messages.forEach((msg, index) => {
      const msgDate = new Date(msg.timestamp).toDateString();
      if (msgDate !== currentDate) {
        grouped.push({ type: 'date', date: msg.timestamp, id: `date-${index}` });
        currentDate = msgDate;
      }
      grouped.push({ type: 'message', ...msg });
    });
    
    return grouped;
  };

  const connectWebSocket = (wa_id) => {
    ws.current = new WebSocket(`wss://whatsapp-clone-backend-5js5.onrender.com/api/ws/${wa_id}`);
    
    ws.current.onopen = () => {
      console.log(`WebSocket connected for wa_id: ${wa_id}`);
      reconnectAttempts.current = 0;
    };
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.ping === 'pong' || data.status === 'connected') return;
      
      setMessages(prev => {
        const exists = prev.some(msg => msg.message_id === data.message_id);
        if (exists) {
          return prev.map(msg => msg.message_id === data.message_id ? data : msg);
        }
        return [...prev, data];
      });
      
      axios.get('https://whatsapp-clone-backend-5js5.onrender.com/api/conversations')
        .then(res => {
          setConversations(res.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
        });
    };
    
    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.current.onclose = () => {
      console.log(`WebSocket closed for wa_id: ${wa_id}`);
      if (reconnectAttempts.current < maxReconnectAttempts) {
        setTimeout(() => {
          reconnectAttempts.current += 1;
          console.log(`Reconnecting WebSocket (attempt ${reconnectAttempts.current})`);
          connectWebSocket(wa_id);
        }, 2000 * reconnectAttempts.current);
      }
    };
  };

  useEffect(() => {
    axios.get('https://whatsapp-clone-backend-5js5.onrender.com/api/conversations')
      .then(res => {
        setConversations(res.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
      })
      .catch(err => console.error('Error fetching conversations:', err));

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedChat) {
      connectWebSocket(selectedChat);
      loadMessages(selectedChat);
    }
    
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [selectedChat]);

  const loadMessages = async (wa_id) => {
    setSelectedChat(wa_id);
    try {
      const res = await axios.get(`https://whatsapp-clone-backend-5js5.onrender.com/api/messages/${wa_id}`);
      setMessages(res.data);
      setUserInfo({ name: `User ${wa_id.slice(-4)}`, number: wa_id });
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const sendMessage = async () => {
    if (newMessage && selectedChat) {
      try {
        await axios.post('https://whatsapp-clone-backend-5js5.onrender.com/api/send-message', {
          wa_id: selectedChat,
          text: newMessage,
        });
        setNewMessage('');
        await loadMessages(selectedChat);
      } catch (err) {
        console.error('Error sending message:', err);
        await loadMessages(selectedChat);
      }
    }
  };

  return (
    <div className="h-screen flex flex-col md:flex-row bg-whatsapp-light">
      {/* Chat List */}
      <div className={`w-full md:w-1/3 bg-white border-r border-gray-200 ${selectedChat ? 'hidden md:block' : 'block'}`}>
        <div className="p-4 bg-whatsapp-green text-white flex items-center">
          <h1 className="text-xl font-semibold">WhatsApp Clone</h1>
        </div>
        <div className="overflow-y-auto h-[calc(100vh-64px)]">
          {conversations.length === 0 ? (
            <div className="p-4 text-gray-500">No conversations yet</div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.wa_id}
                className={`flex items-center p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-100 ${selectedChat === conv.wa_id ? 'bg-gray-100' : ''}`}
                onClick={() => loadMessages(conv.wa_id)}
              >
                <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                  <span className="text-lg font-medium text-gray-600">{conv.wa_id.slice(-2)}</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <h3 className="font-medium text-gray-800">{`User ${conv.wa_id.slice(-4)}`}</h3>
                    <span className="text-xs text-gray-500">{formatDate(conv.timestamp)}</span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">{conv.last_message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className={`flex-1 flex flex-col ${selectedChat ? 'block' : 'hidden md:block'}`}>
        {selectedChat ? (
          <>
            <div className="p-4 bg-whatsapp-dark text-white flex items-center">
              <button className="md:hidden mr-4" onClick={() => setSelectedChat(null)}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                <span className="text-lg font-medium text-gray-600">{userInfo.number.slice(-2)}</span>
              </div>
              <div>
                <h2 className="text-lg font-medium">{userInfo.name}</h2>
                <p className="text-sm text-gray-300">{userInfo.number}</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-whatsapp-bg">
              {groupMessagesByDate(messages).map(item => (
                item.type === 'date' ? (
                  <div key={item.id} className="flex justify-center my-2">
                    <span className="text-xs text-gray-600 bg-gray-200 px-3 py-1 rounded-full">
                      {formatDate(item.date)}
                    </span>
                  </div>
                ) : (
                  <div
                    key={item.message_id}
                    className={`flex mb-3 ${item.wa_id === selectedChat ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`p-3 rounded-lg max-w-[70%] ${item.wa_id === selectedChat ? 'bg-message-out' : 'bg-message-in'} shadow-sm`}
                    >
                      <p className="text-sm">{item.text}</p>
                      <div className="text-xs text-gray-500 mt-1 flex items-center justify-end">
                        <span>{new Date(item.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {item.wa_id === selectedChat && (
                          <span className="ml-2">
                            {item.status === 'read' ? (
                              <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" />
                              </svg>
                            ) : item.status === 'delivered' ? (
                              <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12h2v2h-2V6zm0 4h2v6h-2v-6z" />
                              </svg>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-center">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 p-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
                  placeholder="Type a message..."
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button
                  onClick={sendMessage}
                  className="ml-2 p-2 bg-whatsapp-green text-white rounded-full hover:bg-green-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-whatsapp-bg">
            <p className="text-gray-500 text-lg">Select a chat to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;