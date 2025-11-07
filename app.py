from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import uuid
from typing import List, Dict
import requests
import json

# 尝试导入ChromaDB
try:
    import chromadb
    from chromadb.config import Settings
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False
    print("警告: ChromaDB未安装，向量数据库功能将不可用")

app = Flask(__name__, static_folder='static')
CORS(app)

# ChromaDB配置
CHROMA_DB_PATH = "./chroma_db"
chroma_client = None
collection = None

# Ollama配置
OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "qwen2.5:7b"  # 可以根据实际情况修改模型名称

def init_chromadb():
    """初始化ChromaDB连接"""
    global chroma_client, collection
    if not CHROMADB_AVAILABLE:
        print("ChromaDB未安装，请运行: pip install chromadb")
        return False
    try:
        chroma_client = chromadb.PersistentClient(
            path=CHROMA_DB_PATH,
            settings=Settings(anonymized_telemetry=False)
        )
        # 获取或创建集合
        collection = chroma_client.get_or_create_collection(
            name="knowledge_base",
            metadata={"hnsw:space": "cosine"}
        )
        print(f"ChromaDB连接成功，当前文档数量: {collection.count()}")
        return True
    except Exception as e:
        print(f"ChromaDB连接失败: {str(e)}")
        return False

def check_ollama_connection():
    """检查Ollama服务是否可用"""
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        return response.status_code == 200
    except:
        return False

def get_ollama_response(prompt: str, context: str = "") -> str:
    """调用Ollama API获取响应"""
    try:
        full_prompt = f"""基于以下上下文信息回答问题。如果上下文中没有相关信息，请基于你的知识回答。

上下文：
{context}

问题：{prompt}

回答："""
        
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": full_prompt,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.9,
                }
            },
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            return result.get("response", "抱歉，无法生成回答。")
        else:
            return f"Ollama API错误: {response.status_code}"
    except Exception as e:
        return f"调用Ollama时出错: {str(e)}"

@app.route('/')
def index():
    """返回前端页面"""
    return send_from_directory('static', 'index.html')

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    chroma_status = chroma_client is not None and collection is not None
    ollama_status = check_ollama_connection()
    
    return jsonify({
        "chromadb": chroma_status,
        "ollama": ollama_status,
        "document_count": collection.count() if collection else 0
    })

@app.route('/api/documents', methods=['GET'])
def get_documents():
    """获取所有文档列表"""
    try:
        if not collection:
            return jsonify({"error": "ChromaDB未初始化"}), 500
        
        # 获取所有文档
        results = collection.get()
        documents = []
        
        if results['ids']:
            for i, doc_id in enumerate(results['ids']):
                documents.append({
                    "id": doc_id,
                    "content": results['documents'][i] if results['documents'] else "",
                    "metadata": results['metadatas'][i] if results['metadatas'] else {}
                })
        
        return jsonify({"documents": documents, "count": len(documents)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/documents/upload', methods=['POST'])
def upload_document():
    """上传文档并向量化"""
    try:
        data = request.json
        content = data.get('content', '').strip()
        title = data.get('title', '未命名文档')
        
        if not content:
            return jsonify({"error": "文档内容不能为空"}), 400
        
        if not collection:
            return jsonify({"error": "ChromaDB未初始化"}), 500
        
        # 生成文档ID
        doc_id = str(uuid.uuid4())
        
        # 将文档添加到ChromaDB
        # 注意：这里需要embedding函数，ChromaDB会自动处理
        collection.add(
            documents=[content],
            ids=[doc_id],
            metadatas=[{"title": title, "source": "upload"}]
        )
        
        return jsonify({
            "success": True,
            "message": "文档上传成功",
            "document_id": doc_id,
            "total_documents": collection.count()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/documents/<doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    """删除文档"""
    try:
        if not collection:
            return jsonify({"error": "ChromaDB未初始化"}), 500
        
        collection.delete(ids=[doc_id])
        
        return jsonify({
            "success": True,
            "message": "文档删除成功",
            "total_documents": collection.count()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/query', methods=['POST'])
def query():
    """问答接口，实现RAG功能"""
    try:
        data = request.json
        question = data.get('question', '').strip()
        
        if not question:
            return jsonify({"error": "问题不能为空"}), 400
        
        if not collection:
            return jsonify({"error": "ChromaDB未初始化"}), 500
        
        if not check_ollama_connection():
            return jsonify({"error": "Ollama服务不可用，请确保Ollama正在运行"}), 503
        
        # 从向量库中检索相关文档
        results = collection.query(
            query_texts=[question],
            n_results=3  # 返回最相关的3个文档片段
        )
        
        # 构建上下文
        context_parts = []
        if results['documents'] and len(results['documents'][0]) > 0:
            for i, doc in enumerate(results['documents'][0]):
                metadata = results['metadatas'][0][i] if results['metadatas'] and results['metadatas'][0] else {}
                title = metadata.get('title', '未知文档')
                context_parts.append(f"[{title}]\n{doc}")
        
        context = "\n\n".join(context_parts)
        
        # 调用Ollama生成回答
        answer = get_ollama_response(question, context)
        
        # 返回结果
        return jsonify({
            "question": question,
            "answer": answer,
            "context_sources": [
                {
                    "title": results['metadatas'][0][i].get('title', '未知文档') if results['metadatas'] and results['metadatas'][0] else '未知文档',
                    "content": doc[:200] + "..." if len(doc) > 200 else doc
                }
                for i, doc in enumerate(results['documents'][0] if results['documents'] and results['documents'][0] else [])
            ],
            "context_count": len(context_parts)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # 设置Windows控制台编码为UTF-8
    import sys
    if sys.platform == 'win32':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except:
            pass
    
    # 确保ChromaDB目录存在
    os.makedirs(CHROMA_DB_PATH, exist_ok=True)
    
    # 初始化ChromaDB
    chroma_init_success = init_chromadb()
    
    print("=" * 50)
    print("RAG问答系统启动中...")
    if chroma_init_success:
        print(f"[OK] ChromaDB连接成功，当前文档数量: {collection.count()}")
    else:
        print("[X] ChromaDB未连接（向量数据库功能不可用）")
        print("  提示: 需要安装ChromaDB，但由于需要编译，可能需要安装Visual C++ Build Tools")
        print("  或者可以尝试: pip install chromadb --no-build-isolation")
    print(f"Ollama地址: {OLLAMA_BASE_URL}")
    print(f"Ollama模型: {OLLAMA_MODEL}")
    print("=" * 50)
    print("应用启动在: http://localhost:5000")
    print("=" * 50)
    
    app.run(debug=True, host='0.0.0.0', port=5000)

