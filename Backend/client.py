import json
import requests
from config import SERVER_ADDRESS, CLIENT_ID

def queue_prompt(prompt):
    p = {"prompt": prompt, "client_id": CLIENT_ID}
    data = json.dumps(p).encode('utf-8')
    req = requests.post(f"http://{SERVER_ADDRESS}/prompt", data=data)
    return req.json()

def get_images(ws, prompt):
    prompt_id = queue_prompt(prompt)['prompt_id']
    print(f"Queued prompt ID: {prompt_id}")
    
    while True:
        out = ws.recv()
        if isinstance(out, str):
            message = json.loads(out)
            if message['type'] == 'executing':
                data = message['data']
                # Node None means the whole prompt finished
                if data['node'] is None and data['prompt_id'] == prompt_id:
                    break
        else:
            continue

    # Fetch history
    history_res = requests.get(f"http://{SERVER_ADDRESS}/history/{prompt_id}").json()
    
    if prompt_id not in history_res:
        print(f"Error: Prompt {prompt_id} not found in history. It might have crashed.")
        return []

    history = history_res[prompt_id]
    if 'outputs' in history and '46' in history['outputs']:
        return history['outputs']['46']['images']
    else:
        print("Warning: Node 46 did not produce any output. Check ComfyUI console for errors.")
        return []