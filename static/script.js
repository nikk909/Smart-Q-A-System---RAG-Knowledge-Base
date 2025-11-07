// API基础URL
const API_BASE = 'http://localhost:5000/api';

// DOM元素
const chromaStatus = document.getElementById('chroma-status');
const ollamaStatus = document.getElementById('ollama-status');
const docCount = document.getElementById('doc-count');
const docList = document.getElementById('doc-list');
const docTitle = document.getElementById('doc-title');
const docContent = document.getElementById('doc-content');
const uploadBtn = document.getElementById('upload-btn');
const chatMessages = document.getElementById('chat-messages');
const questionInput = document.getElementById('question-input');
const sendBtn = document.getElementById('send-btn');
const loadingOverlay = document.getElementById('loading-overlay');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    checkHealth();
    loadDocuments();
    
    // 事件监听
    uploadBtn.addEventListener('click', handleUpload);
    sendBtn.addEventListener('click', handleSend);
    questionInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
    
    // 定期检查健康状态
    setInterval(checkHealth, 10000);
});

// 健康检查
async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        const data = await response.json();
        
        // 更新状态
        updateStatus('chroma', data.chromadb);
        updateStatus('ollama', data.ollama);
        docCount.innerHTML = `<span>📄 文档: ${data.document_count}</span>`;
    } catch (error) {
        console.error('健康检查失败:', error);
        updateStatus('chroma', false);
        updateStatus('ollama', false);
    }
}

// 更新状态显示
function updateStatus(type, isActive) {
    const statusElement = type === 'chroma' ? chromaStatus : ollamaStatus;
    const dot = statusElement.querySelector('.status-dot');
    
    if (isActive) {
        dot.classList.add('active');
        statusElement.style.color = '#10b981';
    } else {
        dot.classList.remove('active');
        statusElement.style.color = '#ef4444';
    }
}

// 加载文档列表
async function loadDocuments() {
    try {
        const response = await fetch(`${API_BASE}/documents`);
        const data = await response.json();
        
        if (data.documents && data.documents.length > 0) {
            docList.innerHTML = '';
            data.documents.forEach(doc => {
                addDocumentToUI(doc);
            });
        } else {
            docList.innerHTML = '<div class="empty-state">暂无文档</div>';
        }
    } catch (error) {
        console.error('加载文档失败:', error);
        docList.innerHTML = '<div class="empty-state">加载失败</div>';
    }
}

// 添加文档到UI
function addDocumentToUI(doc) {
    const docItem = document.createElement('div');
    docItem.className = 'doc-item';
    docItem.dataset.id = doc.id;
    
    const title = doc.metadata?.title || '未命名文档';
    const content = doc.content || doc.document || '';
    const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
    
    docItem.innerHTML = `
        <div class="doc-item-header">
            <div class="doc-item-title">${escapeHtml(title)}</div>
            <button class="btn btn-danger" onclick="deleteDocument('${doc.id}')">删除</button>
        </div>
        <div class="doc-item-content">${escapeHtml(preview)}</div>
    `;
    
    docList.insertBefore(docItem, docList.firstChild);
}

// 上传文档
async function handleUpload() {
    const title = docTitle.value.trim();
    const content = docContent.value.trim();
    
    if (!content) {
        alert('请输入文档内容');
        return;
    }
    
    if (!title) {
        alert('请输入文档标题');
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/documents/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                content: content
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // 清空输入
            docTitle.value = '';
            docContent.value = '';
            
            // 重新加载文档列表
            loadDocuments();
            checkHealth();
            
            alert('文档上传成功！');
        } else {
            alert(data.error || '上传失败');
        }
    } catch (error) {
        console.error('上传失败:', error);
        alert('上传失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 删除文档
async function deleteDocument(docId) {
    if (!confirm('确定要删除这个文档吗？')) {
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/documents/${docId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // 从UI中移除
            const docItem = document.querySelector(`.doc-item[data-id="${docId}"]`);
            if (docItem) {
                docItem.remove();
            }
            
            // 更新计数
            checkHealth();
            
            alert('文档删除成功！');
        } else {
            alert(data.error || '删除失败');
        }
    } catch (error) {
        console.error('删除失败:', error);
        alert('删除失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 发送问题
async function handleSend() {
    const question = questionInput.value.trim();
    
    if (!question) {
        return;
    }
    
    // 禁用输入
    questionInput.disabled = true;
    sendBtn.disabled = true;
    
    // 添加用户消息
    addMessage('user', question);
    
    // 清空输入框
    questionInput.value = '';
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question: question
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // 添加助手消息
            addMessage('assistant', data.answer, data.context_sources);
        } else {
            addMessage('assistant', `错误: ${data.error || '请求失败'}`);
        }
    } catch (error) {
        console.error('查询失败:', error);
        addMessage('assistant', `错误: ${error.message}`);
    } finally {
        hideLoading();
        questionInput.disabled = false;
        sendBtn.disabled = false;
        questionInput.focus();
    }
}

// 添加消息到聊天区
function addMessage(role, content, sources = null) {
    // 如果是第一条消息，移除欢迎信息
    if (chatMessages.querySelector('.welcome-message')) {
        chatMessages.innerHTML = '';
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = content;
    
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.textContent = role === 'user' ? '您' : 'AI助手';
    
    messageDiv.appendChild(bubble);
    messageDiv.appendChild(meta);
    
    // 如果有来源，添加来源信息
    if (sources && sources.length > 0) {
        const sourcesDiv = document.createElement('div');
        sourcesDiv.className = 'message-sources';
        sourcesDiv.innerHTML = `
            <div class="message-sources-title">📚 参考来源 (${sources.length})</div>
            ${sources.map(source => `
                <div class="source-item">
                    <strong>${escapeHtml(source.title)}</strong>: ${escapeHtml(source.content)}
                </div>
            `).join('')}
        `;
        messageDiv.appendChild(sourcesDiv);
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 显示/隐藏加载提示
function showLoading() {
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 全局函数（供HTML调用）
window.deleteDocument = deleteDocument;

