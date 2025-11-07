# 智能问答系统 - RAG知识库
# Smart Q&A System - RAG Knowledge Base

## 项目简介 / Project Introduction

基于Flask + ChromaDB + Ollama的本地知识库问答系统，实现检索增强生成（RAG）功能。

A local knowledge base Q&A system based on Flask + ChromaDB + Ollama, implementing Retrieval-Augmented Generation (RAG) functionality.

## 功能特性 / Features

- **文档管理** / Document Management: 支持上传、查看、删除文档
- **向量存储** / Vector Storage: 使用ChromaDB本地向量数据库
- **智能检索** / Intelligent Retrieval: 基于语义相似度的文档检索
- **RAG问答** / RAG Q&A: 结合检索结果和Ollama模型生成回答
- **中文支持** / Chinese Support: 完整支持中文问答

## 技术栈 / Tech Stack

- **后端** / Backend: Flask (Python)
- **向量数据库** / Vector Database: ChromaDB
- **AI模型** / AI Model: Ollama (本地大模型)
- **前端** / Frontend: HTML, CSS, JavaScript

## 环境要求 / Requirements

- Python 3.8+
- Ollama (需要单独安装并运行 / needs to be installed separately)
- ChromaDB (通过pip安装 / install via pip)

## 安装步骤 / Installation

### 1. 安装Python依赖 / Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. 安装并启动Ollama / Install and Start Ollama

访问 [Ollama官网](https://ollama.ai/) 下载并安装 / Visit [Ollama website](https://ollama.ai/) to download and install.

下载模型 / Download model:
```bash
ollama pull qwen2.5:7b
```

### 3. 启动应用 / Start Application

```bash
python app.py
```

访问 / Access: `http://localhost:5000`

## 使用说明 / Usage

1. **上传文档** / Upload Documents: 在左侧文档管理区域上传文档
2. **问答功能** / Q&A: 在右侧问答区域输入问题，系统会从知识库检索并生成回答
3. **文档管理** / Document Management: 查看和管理已上传的文档

## 项目结构 / Project Structure

```
work6/
├── app.py              # Flask后端应用
├── requirements.txt    # Python依赖
├── README.md          # 项目说明
├── chroma_db/         # ChromaDB数据目录（自动创建）
└── static/            # 前端静态文件
    ├── index.html     # 主页面
    ├── style.css      # 样式文件
    └── script.js      # JavaScript逻辑
```

---

## 作业内容：知识库管理界面示例
## Assignment: Knowledge Base Management Interface Example

### 题目 / Title
**知识库管理界面与智能问答系统演示**
**Knowledge Base Management Interface and Intelligent Q&A System Demonstration**

### 说明 / Description

以下图片展示了本智能问答系统中的知识库管理界面和智能问答功能。用户可以在知识库管理界面上传、查看和管理文档，这些文档将作为RAG问答的知识来源。在智能问答界面中，系统能够从知识库中检索相关信息，并结合大语言模型生成高质量的回答。

The images below illustrate the knowledge base management interface and intelligent Q&A functionality of this system. Users can upload, view, and manage documents in the knowledge base management interface, which serve as the knowledge source for RAG-based Q&A. In the intelligent Q&A interface, the system can retrieve relevant information from the knowledge base and generate high-quality answers combined with large language models.

![知识库管理界面](image.png)

![智能问答界面](image.png)

![A/B测试问答示例](image.png)
