import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import socketService from '../services/socketService';
import { FaPaperPlane, FaUser } from 'react-icons/fa';
import './Chat.css';

const Chat = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [connected, setConnected] = useState(false);
  const messagesEndRef = useRef(null);

  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    
    // Initialize Socket.IO connection
    const socket = socketService.connect();
    socketRef.current = socket;

    if (!socket) {
      console.error('Failed to connect to chat server');
      return;
    }

    socket.on('connect', () => {
      console.log('Chat socket connected');
      setConnected(true);
      // Load conversations on connect
      socketService.getConversations();
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('conversations_list', (data) => {
      if (data.conversations) {
        setConversations(data.conversations);
      }
    });

    socket.on('new_message', (data) => {
      if (data.message) {
        const message = data.message;
        // Only add if it's for the current conversation
        if (selectedConversation && 
            (message.senderId._id === selectedConversation.otherUser._id || 
             message.receiverId._id === selectedConversation.otherUser._id)) {
          setMessages(prev => [...prev, message]);
        }
        // Update conversation list
        setConversations(prev => {
          const updated = [...prev];
          const convIndex = updated.findIndex(
            c => c.otherUser._id === message.senderId._id || c.otherUser._id === message.receiverId._id
          );
          if (convIndex >= 0) {
            updated[convIndex] = {
              ...updated[convIndex],
              lastMessage: message.message,
              lastMessageTime: message.timestamp,
              unreadCount: message.receiverId._id === user._id ? (updated[convIndex].unreadCount || 0) + 1 : updated[convIndex].unreadCount
            };
          }
          return updated;
        });
      }
    });

    socket.on('message_sent', (data) => {
      if (data.message) {
        setMessages(prev => [...prev, data.message]);
      }
    });

    socket.on('messages_list', (data) => {
      if (data.messages) {
        setMessages(data.messages);
      }
    });

    socket.on('message_error', (data) => {
      alert(data.message || 'Error with message');
    });

    socket.on('user_online', (data) => {
      // Handle user online status
    });

    socket.on('user_offline', (data) => {
      // Handle user offline status
    });

    return () => {
      if (socket) {
        socketService.disconnect();
      }
    };
  }, [isAuthenticated, navigate, selectedConversation, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    // Fetch messages for this conversation
    if (conversation.otherUser._id) {
      socketService.getMessages(conversation.otherUser._id);
      // Mark messages as read
      socketService.markMessagesRead(conversation.otherUser._id);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedConversation || !connected) {
      if (!connected) {
        alert('Not connected to chat server. Please refresh the page.');
      }
      return;
    }

    const receiverId = selectedConversation.otherUser._id;
    if (!receiverId) {
      alert('Invalid conversation');
      return;
    }

    socketService.sendMessage(receiverId, newMessage.trim(), selectedConversation._id || null);
    setNewMessage('');
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-NP', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div>
      <Navigation />
      <div className="chat-page">
        <div className="chat-container">
          <div className="chat-header">
            <h1 className="chat-title">Messages</h1>
            <span className={`chat-connection-status ${connected ? 'chat-connected' : 'chat-disconnected'}`}>
              {connected ? '🟢 Online' : '🔴 Offline'}
            </span>
          </div>

          <div className="chat-content">
            {/* Conversations List */}
            <div className="chat-conversations">
              <h2 className="chat-conversations-title">Conversations</h2>
              <div className="chat-conversations-list">
                {conversations.length === 0 ? (
                  <div className="chat-empty">No conversations yet</div>
                ) : (
                  conversations.map((conversation) => (
                    <div
                      key={conversation._id}
                      className={`chat-conversation-item ${selectedConversation?._id === conversation._id ? 'chat-conversation-selected' : ''}`}
                      onClick={() => handleSelectConversation(conversation)}
                    >
                      <div className="chat-conversation-avatar">
                        <FaUser />
                      </div>
                      <div className="chat-conversation-info">
                        <div className="chat-conversation-header">
                          <span className="chat-conversation-name">{conversation.otherUser.fullName}</span>
                          {conversation.unreadCount > 0 && (
                            <span className="chat-conversation-unread">{conversation.unreadCount}</span>
                          )}
                        </div>
                        <p className="chat-conversation-preview">{conversation.lastMessage}</p>
                        <span className="chat-conversation-time">{formatTime(conversation.lastMessageTime)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Messages Area */}
            <div className="chat-messages-area">
              {selectedConversation ? (
                <>
                  <div className="chat-messages-header">
                    <h3>{selectedConversation.otherUser.fullName}</h3>
                  </div>
                  <div className="chat-messages-list">
                    {messages.map((message) => {
                      const isOwn = message.sender._id === user._id;
                      return (
                        <div key={message._id} className={`chat-message ${isOwn ? 'chat-message-own' : ''}`}>
                          {!isOwn && (
                            <div className="chat-message-avatar">
                              <FaUser />
                            </div>
                          )}
                          <div className="chat-message-content">
                            <div className="chat-message-text">{message.message}</div>
                            <div className="chat-message-time">{formatTime(message.timestamp)}</div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                  <form onSubmit={handleSendMessage} className="chat-message-form">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="chat-message-input"
                    />
                    <button type="submit" className="chat-message-send-btn">
                      <FaPaperPlane />
                    </button>
                  </form>
                </>
              ) : (
                <div className="chat-no-selection">
                  <FaUser className="chat-no-selection-icon" />
                  <p>Select a conversation to start messaging</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;

