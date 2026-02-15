from typing import List
from langchain_core.documents import Document
import logging

logger = logging.getLogger(__name__)

class RerankService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RerankService, cls).__new__(cls)
            cls._instance.model = None
            cls._instance.model_loaded = False
        return cls._instance

    def _load_model(self):
        if not self.model_loaded:
            try:
                from sentence_transformers import CrossEncoder
                # Use a lightweight model by default. 
                # ms-marco-TinyBERT-L-2 is very fast and small (~15MB)
                # WARNING: This model is English-only. For Chinese, use 'BAAI/bge-reranker-base'
                # For now, we default to None (disabled) to avoid poor performance on Chinese queries
                # until a proper Chinese model is selected/downloaded.
                model_name = None # "cross-encoder/ms-marco-TinyBERT-L-2-v2" 
                
                if model_name:
                    logger.info(f"Loading Rerank model: {model_name}...")
                    self.model = CrossEncoder(model_name)
                    logger.info("Rerank model loaded successfully.")
                else:
                    logger.info("Rerank model not configured (using None). Reranking disabled.")
                    self.model = None

                self.model_loaded = True
            except ImportError:
                logger.warning("sentence-transformers not installed. Reranking will be skipped.")
                self.model = None
                self.model_loaded = True # Mark as loaded (failed) to avoid retrying
            except Exception as e:
                logger.error(f"Failed to load Rerank model: {e}")
                self.model = None
                self.model_loaded = True

    def rerank(self, query: str, documents: List[Document], top_k: int = 4) -> List[Document]:
        """Rerank documents based on query relevance using Cross-Encoder."""
        self._load_model()
        
        if not self.model or not documents:
            return documents[:top_k]
            
        try:
            # Prepare pairs for scoring
            # Truncate content to avoid token limit issues (CrossEncoders have limits)
            pairs = [[query, doc.page_content[:2000]] for doc in documents]
            
            scores = self.model.predict(pairs)
            
            # Combine docs with scores
            doc_score_pairs = list(zip(documents, scores))
            
            # Sort by score descending
            doc_score_pairs.sort(key=lambda x: x[1], reverse=True)
            
            # Select top_k
            reranked_docs = []
            for doc, score in doc_score_pairs[:top_k]:
                # Add score to metadata for debugging/UI
                doc.metadata["relevance_score"] = float(score)
                reranked_docs.append(doc)
            
            logger.info(f"Reranking complete. Top score: {doc_score_pairs[0][1] if doc_score_pairs else 0}")
            return reranked_docs
            
        except Exception as e:
            logger.error(f"Reranking failed: {e}")
            return documents[:top_k]
