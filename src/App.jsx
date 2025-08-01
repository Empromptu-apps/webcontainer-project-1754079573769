import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

const FlowFiCredentialsAgent = () => {
  const [currentView, setCurrentView] = useState('admin');
  const [sessions, setSessions] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [userMessage, setUserMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentId, setAgentId] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [apiLogs, setApiLogs] = useState([]);
  const [createdObjects, setCreatedObjects] = useState([]);
  const chatEndRef = useRef(null);
  const messageInputRef = useRef(null);

  const API_BASE = 'https://staging.empromptu.ai/api_tools';
  const API_HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer f6b6dd9ed77bcbd92045056c7ce2a84b',
    'X-Generated-App-ID': '10011e5c-1a26-4dff-bc4a-e5ca47e07dbb',
    'X-Usage-Key': '0fa26870b41300015380dbc86f77204b'
  };

  // Toggle dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Log API calls
  const logApiCall = (endpoint, method, data, response) => {
    const log = {
      timestamp: new Date().toISOString(),
      endpoint,
      method,
      request: data,
      response
    };
    setApiLogs(prev => [...prev, log]);
  };

  // Initialize platform templates
  useEffect(() => {
    const defaultPlatforms = [
      {
        id: 'chase',
        name: 'Chase Bank',
        instructions: `I'll help you grant access to your Chase Bank account for FlowFi. Here's what we'll do:

1. Log into your Chase online banking account
2. Navigate to "Secure Messages" or "Message Center"
3. Look for "Add Authorized User" or "Account Access"
4. Add the email: {client_email}@flowfi.com
5. Grant "View Only" access to all relevant accounts
6. Confirm the access was granted

Let me know when you're ready to start, or if you have any questions!`
      },
      {
        id: 'amex',
        name: 'American Express',
        instructions: `I'll guide you through granting FlowFi access to your American Express account:

1. Log into your Amex online account
2. Go to "Account Services" > "Account Access"
3. Select "Add Authorized User" or "Grant Access"
4. Enter the email: {client_email}@flowfi.com
5. Set permissions to "View Statements and Account Activity"
6. Submit the access request

Ready to begin? Just let me know!`
      },
      {
        id: 'gusto',
        name: 'Gusto Payroll',
        instructions: `Let's set up FlowFi access to your Gusto payroll account:

1. Log into your Gusto admin account
2. Go to "Settings" > "Integrations" or "Account Access"
3. Look for "Add Accountant" or "Grant Access"
4. Enter: {client_email}@flowfi.com
5. Grant "Payroll Reports" and "Tax Documents" access
6. Send the invitation

I'll walk you through each step. Are you ready to start?`
      }
    ];
    setPlatforms(defaultPlatforms);
  }, []);

  // Create AI agent for session
  const createAgent = async (sessionData) => {
    try {
      const instructions = `You are a helpful financial account access assistant for FlowFi. 
      
Your role is to guide ${sessionData.clientName} through granting access to their ${sessionData.platform} account.

Key guidelines:
- Be patient and encouraging
- Break down complex steps into simple actions
- Ask for confirmation before moving to the next step
- If they're confused, offer to explain differently
- Always maintain a professional but friendly tone
- When they complete all steps, ask them to confirm access was granted

Platform-specific instructions:
${sessionData.instructions}

Remember: You're helping them grant access to {client_email}@flowfi.com for their ${sessionData.platform} account.`;

      const requestData = {
        instructions: instructions.replace('{client_email}', sessionData.clientName.toLowerCase().replace(/\s+/g, '')),
        agent_name: 'FlowFi Access Assistant'
      };

      const response = await fetch(`${API_BASE}/create-agent`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(requestData)
      });

      const data = await response.json();
      logApiCall('/create-agent', 'POST', requestData, data);
      
      if (data.agent_id) {
        setCreatedObjects(prev => [...prev, { type: 'agent', id: data.agent_id }]);
      }
      
      return data.agent_id;
    } catch (error) {
      console.error('Error creating agent:', error);
      logApiCall('/create-agent', 'POST', null, { error: error.message });
      return null;
    }
  };

  // Send message to agent
  const sendMessage = async (message) => {
    if (!agentId) return;

    try {
      const requestData = {
        agent_id: agentId,
        message: message
      };

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(requestData)
      });

      const data = await response.json();
      logApiCall('/chat', 'POST', requestData, data);
      
      return data.response;
    } catch (error) {
      console.error('Error sending message:', error);
      logApiCall('/chat', 'POST', null, { error: error.message });
      return 'I apologize, but I encountered an error. Please try again.';
    }
  };

  // Store session data
  const storeSessionData = async (sessionData) => {
    try {
      const objectName = `flowfi_session_${sessionData.id}`;
      const requestData = {
        created_object_name: objectName,
        data_type: 'strings',
        input_data: [JSON.stringify(sessionData)]
      };

      const response = await fetch(`${API_BASE}/input_data`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(requestData)
      });

      const data = await response.json();
      logApiCall('/input_data', 'POST', requestData, data);
      
      setCreatedObjects(prev => [...prev, { type: 'data', id: objectName }]);
    } catch (error) {
      console.error('Error storing session data:', error);
      logApiCall('/input_data', 'POST', null, { error: error.message });
    }
  };

  // Create new session
  const createSession = async (sessionData) => {
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    
    const newSession = {
      id: sessionId,
      ...sessionData,
      createdAt: new Date(),
      expiresAt,
      status: 'active',
      chatHistory: [],
      completed: false
    };

    setSessions(prev => [...prev, newSession]);
    await storeSessionData(newSession);
    
    return sessionId;
  };

  // Load session for client
  const loadSession = async (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      alert('Session not found or expired');
      return;
    }

    if (new Date() > new Date(session.expiresAt)) {
      alert('This session has expired. Please contact FlowFi for a new link.');
      return;
    }

    setCurrentSession(session);
    setChatHistory(session.chatHistory || []);
    
    const newAgentId = await createAgent(session);
    setAgentId(newAgentId);
    
    if (newAgentId && session.chatHistory.length === 0) {
      const greeting = await sendMessage(`Hello! I'm here to help ${session.clientName} set up access for ${session.platform}.`);
      const newMessage = { type: 'agent', message: greeting, timestamp: new Date() };
      setChatHistory([newMessage]);
      
      const updatedSession = { ...session, chatHistory: [newMessage] };
      setSessions(prev => prev.map(s => s.id === sessionId ? updatedSession : s));
      await storeSessionData(updatedSession);
    }
    
    setCurrentView('client');
  };

  // Handle client message
  const handleClientMessage = async () => {
    if (!userMessage.trim() || !agentId) return;

    setIsLoading(true);
    
    const userMsg = { type: 'user', message: userMessage, timestamp: new Date() };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    
    const response = await sendMessage(userMessage);
    const agentMsg = { type: 'agent', message: response, timestamp: new Date() };
    const finalHistory = [...newHistory, agentMsg];
    setChatHistory(finalHistory);
    
    const updatedSession = { ...currentSession, chatHistory: finalHistory };
    setCurrentSession(updatedSession);
    setSessions(prev => prev.map(s => s.id === currentSession.id ? updatedSession : s));
    await storeSessionData(updatedSession);
    
    setUserMessage('');
    setIsLoading(false);
  };

  // Mark session as completed
  const markCompleted = async () => {
    const updatedSession = { ...currentSession, completed: true, status: 'completed', completedAt: new Date() };
    setCurrentSession(updatedSession);
    setSessions(prev => prev.map(s => s.id === currentSession.id ? updatedSession : s));
    await storeSessionData(updatedSession);
  };

  // Delete created objects
  const deleteObjects = async () => {
    for (const obj of createdObjects) {
      try {
        if (obj.type === 'data') {
          await fetch(`${API_BASE}/objects/${obj.id}`, {
            method: 'DELETE',
            headers: API_HEADERS
          });
          logApiCall(`/objects/${obj.id}`, 'DELETE', null, { deleted: true });
        }
      } catch (error) {
        console.error('Error deleting object:', error);
      }
    }
    setCreatedObjects([]);
    alert('All created objects have been deleted.');
  };

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Focus input when not loading
  useEffect(() => {
    if (!isLoading && messageInputRef.current) {
      messageInputRef.current.focus();
    }
  }, [isLoading]);

  // Admin Interface
  const AdminInterface = () => {
    const [newSession, setNewSession] = useState({
      clientName: '',
      clientEmail: '',
      platform: '',
      customInstructions: '',
      notes: ''
    });

    const handleCreateSession = async () => {
      if (!newSession.clientName || !newSession.platform) {
        alert('Please fill in required fields');
        return;
      }

      const platform = platforms.find(p => p.id === newSession.platform);
      const sessionData = {
        ...newSession,
        instructions: newSession.customInstructions || platform.instructions,
        platformName: platform.name
      };

      const sessionId = await createSession(sessionData);
      const sessionUrl = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
      
      alert(`Session created! Share this link with your client:\n\n${sessionUrl}`);
      
      setNewSession({
        clientName: '',
        clientEmail: '',
        platform: '',
        customInstructions: '',
        notes: ''
      });
    };

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">FlowFi Credentials Agent</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">Admin Dashboard</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                aria-label="Toggle dark mode"
              >
                {darkMode ? 'âï¸' : 'ð'}
              </button>
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="btn-secondary"
              >
                {showDebug ? 'Hide Debug' : 'Show Debug'}
              </button>
              {createdObjects.length > 0 && (
                <button
                  onClick={deleteObjects}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Delete Objects ({createdObjects.length})
                </button>
              )}
            </div>
          </div>

          {/* Debug Panel */}
          {showDebug && (
            <div className="card p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">API Debug Logs</h3>
              <div className="max-h-64 overflow-y-auto bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                {apiLogs.map((log, index) => (
                  <div key={index} className="mb-4 text-sm">
                    <div className="font-mono text-green-600 dark:text-green-400">
                      {log.method} {log.endpoint} - {log.timestamp}
                    </div>
                    <div className="text-gray-600 dark:text-gray-300 ml-4">
                      Request: {JSON.stringify(log.request, null, 2)}
                    </div>
                    <div className="text-gray-600 dark:text-gray-300 ml-4">
                      Response: {JSON.stringify(log.response, null, 2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create New Session */}
          <div className="card p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Create New Session</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client Name *
                </label>
                <input
                  type="text"
                  value={newSession.clientName}
                  onChange={(e) => setNewSession({...newSession, clientName: e.target.value})}
                  className="input-field"
                  placeholder="Enter client name"
                  aria-required="true"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client Email
                </label>
                <input
                  type="email"
                  value={newSession.clientEmail}
                  onChange={(e) => setNewSession({...newSession, clientEmail: e.target.value})}
                  className="input-field"
                  placeholder="client@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Platform *
                </label>
                <select
                  value={newSession.platform}
                  onChange={(e) => setNewSession({...newSession, platform: e.target.value})}
                  className="input-field"
                  aria-required="true"
                >
                  <option value="">Select Platform</option>
                  {platforms.map(platform => (
                    <option key={platform.id} value={platform.id}>{platform.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes
                </label>
                <input
                  type="text"
                  value={newSession.notes}
                  onChange={(e) => setNewSession({...newSession, notes: e.target.value})}
                  className="input-field"
                  placeholder="Optional notes"
                />
              </div>
            </div>
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Custom Instructions (Optional)
              </label>
              <textarea
                value={newSession.customInstructions}
                onChange={(e) => setNewSession({...newSession, customInstructions: e.target.value})}
                className="input-field h-32 resize-none"
                placeholder="Leave empty to use platform default instructions..."
              />
            </div>
            <button
              onClick={handleCreateSession}
              className="btn-primary mt-6 px-8 py-3 text-lg"
            >
              Create Session Link
            </button>
          </div>

          {/* Active Sessions */}
          <div className="card p-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Session Management</h2>
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-4 px-4 font-semibold text-gray-900 dark:text-white">Client</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-900 dark:text-white">Platform</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-900 dark:text-white">Status</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-900 dark:text-white">Created</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-900 dark:text-white">Expires</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-900 dark:text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(session => (
                    <tr key={session.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="py-4 px-4 text-gray-900 dark:text-white">{session.clientName}</td>
                      <td className="py-4 px-4 text-gray-600 dark:text-gray-400">{session.platformName}</td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                          session.completed 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}>
                          {session.completed ? 'Completed' : 'Active'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                        {new Date(session.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                        {new Date(session.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4">
                        <button
                          onClick={() => loadSession(session.id)}
                          className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-200 font-medium"
                        >
                          View Chat
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Client Interface - Chatbot Panel
  const ClientInterface = () => {
    if (!currentSession) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="card p-8 text-center max-w-md">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Session Not Found</h1>
            <p className="text-gray-600 dark:text-gray-400">Please check your link or contact FlowFi for assistance.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        {/* Mobile Header */}
        <div className="lg:hidden bg-primary-600 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-bold text-sm">Fi</span>
              </div>
              <div>
                <h1 className="font-semibold">FlowFi Assistant</h1>
                <p className="text-sm opacity-90">Account Access Setup</p>
              </div>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg bg-primary-700 hover:bg-primary-800 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? 'âï¸' : 'ð'}
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-4 lg:p-6">
          {/* Desktop Header */}
          <div className="hidden lg:block mb-8">
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-lg">Fi</span>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">FlowFi Account Access Setup</h1>
                    <p className="text-gray-600 dark:text-gray-400">Hi {currentSession.clientName}! I'll help you grant access to your {currentSession.platformName} account.</p>
                  </div>
                </div>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  aria-label="Toggle dark mode"
                >
                  {darkMode ? 'âï¸' : 'ð'}
                </button>
              </div>
            </div>
          </div>

          {/* Chat Panel */}
          <div className="card overflow-hidden">
            {/* Chat Messages */}
            <div 
              className="h-96 lg:h-[500px] overflow-y-auto p-6 bg-gray-50 dark:bg-gray-800"
              role="log"
              aria-live="polite"
              aria-label="Chat messages"
            >
              {chatHistory.map((msg, index) => (
                <div key={index} className={`mb-4 chat-bubble ${msg.type === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`inline-block p-4 rounded-2xl max-w-xs lg:max-w-md shadow-sm ${
                    msg.type === 'user' 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600'
                  }`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                    <p className="text-xs mt-2 opacity-70">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="text-left mb-4">
                  <div className="inline-block p-4 rounded-2xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600 shadow-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full spinner"></div>
                      <p>Typing...</p>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-3">
                <input
                  ref={messageInputRef}
                  type="text"
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleClientMessage()}
                  placeholder="Ask me anything..."
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  disabled={isLoading}
                  aria-label="Type your message"
                />
                <button
                  onClick={handleClientMessage}
                  disabled={isLoading || !userMessage.trim()}
                  className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  aria-label="Send message"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              
              {!currentSession.completed && (
                <div className="mt-4 text-center">
                  <button
                    onClick={markCompleted}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  >
                    â I've completed the access setup
                  </button>
                </div>
              )}
              
              {currentSession.completed && (
                <div className="mt-4 p-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-xl text-center border border-green-200 dark:border-green-700">
                  <p className="font-semibold">â Access setup completed!</p>
                  <p className="mt-1">Thank you! FlowFi has been notified that access has been granted.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Admin View Button */}
        <div className="fixed top-4 right-4">
          <button
            onClick={() => setCurrentView('admin')}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg"
          >
            Admin View
          </button>
        </div>
      </div>
    );
  };

  // Check for session parameter in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');
    if (sessionId) {
      loadSession(sessionId);
    }
  }, [sessions]);

  return (
    <>
      {currentView === 'admin' ? <AdminInterface /> : <ClientInterface />}
    </>
  );
};

export default FlowFiCredentialsAgent;
