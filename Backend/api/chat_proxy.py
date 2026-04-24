from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
import httpx
import logging
import json

router = APIRouter(prefix="/api/chat", tags=["Chat"])
logger = logging.getLogger(__name__)

@router.post("/proxy")
async def proxy_chat(request: Request):
    """
    Proxies chat requests to LM Studio to avoid browser CORS issues.
    Supports both standard and streaming responses.
    """
    try:
        body = await request.json()
        target_url = body.get("target_url")
        payload = body.get("payload")

        if not target_url or not payload:
            raise HTTPException(status_code=400, detail="Missing target_url or payload")

        is_streaming = payload.get("stream", False)

        if is_streaming:
            async def stream_generator():
                async with httpx.AsyncClient(timeout=60.0) as client:
                    async with client.stream(
                        "POST",
                        target_url,
                        json=payload,
                        headers={"Content-Type": "application/json"}
                    ) as response:
                        if response.status_code != 200:
                            yield json.dumps({"error": f"LM Studio returned {response.status_code}"}).encode()
                            return
                            
                        async for chunk in response.aiter_bytes():
                            yield chunk

            return StreamingResponse(stream_generator(), media_type="text/event-stream")
        else:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    target_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                return response.json()

    except httpx.ConnectError:
        logger.error(f"Could not connect to LM Studio at {target_url}")
        raise HTTPException(status_code=502, detail=f"Could not connect to LM Studio at {target_url}. Ensure it is running and accessible.")
    except Exception as e:
        logger.exception("Chat proxy error")
        raise HTTPException(status_code=500, detail=str(e))
