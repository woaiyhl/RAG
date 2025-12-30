from duckduckgo_search import DDGS
from langchain_core.documents import Document
from typing import List
import logging
import asyncio
import os
from functools import partial

logger = logging.getLogger(__name__)

class WebSearchService:
    @staticmethod
    def search(query: str, max_results: int = 5) -> List[Document]:
        """
        Perform a web search using DuckDuckGo.
        Returns a list of Documents compatible with LangChain.
        """
        # Check and log proxy settings for debugging
        proxy = os.getenv("HTTP_PROXY") or os.getenv("HTTPS_PROXY")
        if proxy:
            logger.info(f"Using proxy for Web Search: {proxy}")
        else:
            logger.info("No proxy configured for Web Search. Ensure direct connection to DuckDuckGo is possible.")

        try:
            results = []
            # strict=False allows fallback if strict search fails
            with DDGS() as ddgs:
                # text() method returns a list of dicts or generator
                # Use backend="html" for better stability if api fails
                search_results = ddgs.text(query, max_results=max_results, backend="html")
                
                if search_results:
                    for r in search_results:
                        # DDGS returns: {'title': ..., 'href': ..., 'body': ...}
                        content = f"标题: {r.get('title')}\n来源: {r.get('href')}\n摘要: {r.get('body')}"
                        doc = Document(
                            page_content=content,
                            metadata={
                                "source": r.get('href'), 
                                "title": r.get('title'), 
                                "type": "web_search"
                            }
                        )
                        results.append(doc)
            
            if not results:
                logger.warning(f"Web search for '{query}' returned no results.")
                return []

            logger.info(f"Web search for '{query}' returned {len(results)} results.")
            return results
        except Exception as e:
            logger.error(f"Web search failed: {e}")
            return []

    @staticmethod
    async def asearch(query: str, max_results: int = 5) -> List[Document]:
        """Async wrapper for search"""
        loop = asyncio.get_running_loop()
        # DDGS requests might block, so run in executor
        return await loop.run_in_executor(None, partial(WebSearchService.search, query, max_results))
