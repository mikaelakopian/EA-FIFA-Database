from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from fastapi.responses import JSONResponse
import logging
from endpoints.leagues import router as leagues_router
from endpoints.teams import router as teams_router
from endpoints.leagueteamlinks import router as leagueteamlinks_router
from endpoints.teamkits import router as teamkits_router
from endpoints.teamnationlinks import router as teamnationlinks_router
from endpoints.teamplayerlinks import router as teamplayerlinks_router
from endpoints.teamstadiumlinks import router as teamstadiumlinks_router
from endpoints.manager import router as manager_router
from endpoints.nations import router as nations_router
from endpoints.playernames import router as playernames_router
from endpoints.players import router as players_router
from endpoints.stadiumassignments import router as stadiumassignments_router
from endpoints.tactics import router as tactics_router
from endpoints.sofifa import router as sofifa_router
from endpoints.transfermarkt import router as transfermarkt_router
from endpoints.websocket import router as websocket_router
from endpoints.projects import router as projects_router
from endpoints.images import router as images_router
from endpoints.db import router as db_router
from endpoints.LanguageStrings2 import router as language_strings_router
try:
    from endpoints.PlayerParametersPredictionsModel import router as ml_predictions_router
except ImportError:
    # Fallback to mock version if PyTorch is not available
    from endpoints.PlayerParametersPredictionsModelMock import router as ml_predictions_router
# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS Configuration - MUST be added before other middleware and routes
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5174",  # Vite sometimes uses different ports
    "*"  # Allow all origins for WebSocket during development
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Add middleware to log all requests (but skip WebSocket)
@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Skip logging for WebSocket upgrade requests
    if request.headers.get("upgrade") == "websocket":
        return await call_next(request)
        
    logger.info(f"Incoming request: {request.method} {request.url}")
    
    response = await call_next(request)
    
    logger.info(f"Response status: {response.status_code}")
    return response

# Подключение routers из папки endpoints
app.include_router(leagues_router)
app.include_router(teams_router)
app.include_router(leagueteamlinks_router)
app.include_router(teamkits_router)
app.include_router(teamnationlinks_router)
app.include_router(teamplayerlinks_router)
app.include_router(teamstadiumlinks_router)
app.include_router(manager_router)
app.include_router(nations_router)
app.include_router(playernames_router)
app.include_router(players_router)
app.include_router(stadiumassignments_router)
app.include_router(tactics_router)
app.include_router(sofifa_router)
app.include_router(transfermarkt_router)
app.include_router(websocket_router, prefix="")
app.include_router(projects_router)
app.include_router(images_router)
app.include_router(db_router)
app.include_router(language_strings_router)
app.include_router(ml_predictions_router)

@app.get("/status")
def status():
    """Проверка статуса подключения"""
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
