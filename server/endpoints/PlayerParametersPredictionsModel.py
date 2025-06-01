"""
Unified Player Parameter Predictions Model with PyTorch and Mock fallback.
Uses parameter_ranges.json for class information and model configuration.
"""

# Try to import PyTorch, fall back to mock mode if not available
try:
    import torch
    import torch.nn as nn
    from torchvision import transforms
    PYTORCH_AVAILABLE = True
except ImportError:
    PYTORCH_AVAILABLE = False
    # Create dummy classes for when PyTorch is not available
    class torch:
        @staticmethod
        def zeros(*args, **kwargs):
            return None
        @staticmethod
        def device(*args, **kwargs):
            return "cpu"
        @staticmethod
        def cuda(*args, **kwargs):
            return False
    
    class nn:
        class Module:
            pass

try:
    from PIL import Image
except ImportError:
    Image = None

import os
import re
import json
import random
import hashlib
from pathlib import Path
from typing import Dict, Optional, List, Any
import asyncio
from fastapi import APIRouter, HTTPException
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Base paths
MODELS_DIR = Path(__file__).parent.parent / "models"
PARAMETER_RANGES_FILE = MODELS_DIR / "parameter_ranges.json"

# Set device and transforms only if PyTorch is available
if PYTORCH_AVAILABLE:
    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    # FC Faces models use 180x180 input size
    TRANSFORM = transforms.Compose([
        transforms.Resize((180, 180)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
else:
    DEVICE = "cpu"
    TRANSFORM = None

if PYTORCH_AVAILABLE:
    # Import torchvision models for FC Faces architecture
    try:
        from torchvision import models
        TORCHVISION_AVAILABLE = True
    except ImportError:
        TORCHVISION_AVAILABLE = False
    
    class SimpleFC25Model(nn.Module):
        """
        FC Faces model architecture - exact copy from working TEST.py
        """
        def __init__(self, output_size: int, model_type: str = 'classification'):
            super(SimpleFC25Model, self).__init__()
            
            self.model_type = model_type
            self.output_size = output_size
            
            if not TORCHVISION_AVAILABLE:
                # Fallback to simple CNN if torchvision not available
                self.backbone = nn.Sequential(
                    nn.Conv2d(3, 64, kernel_size=3, padding=1),
                    nn.ReLU(inplace=True),
                    nn.MaxPool2d(kernel_size=2, stride=2),
                    nn.Conv2d(64, 128, kernel_size=3, padding=1),
                    nn.ReLU(inplace=True),
                    nn.MaxPool2d(kernel_size=2, stride=2),
                    nn.Conv2d(128, 256, kernel_size=3, padding=1),
                    nn.ReLU(inplace=True),
                    nn.AdaptiveAvgPool2d((1, 1))
                )
                self.feature_dim = 256
            else:
                # Choose backbone based on complexity (exact from TEST.py)
                if output_size <= 10:
                    # Simple task - ResNet18
                    self.backbone = models.resnet18(pretrained=True)
                    self.feature_dim = 512
                elif output_size <= 100:
                    # Medium task - ResNet34
                    self.backbone = models.resnet34(pretrained=True)
                    self.feature_dim = 512
                else:
                    # Complex task - ResNet50
                    self.backbone = models.resnet50(pretrained=True)
                    self.feature_dim = 2048
                
                # Remove last layer
                self.backbone = nn.Sequential(*list(self.backbone.children())[:-1])
            
            # Create output layer (exact from TEST.py)
            if model_type == 'regression':
                self.head = nn.Sequential(
                    nn.Dropout(0.3),
                    nn.Linear(self.feature_dim, 128),
                    nn.ReLU(),
                    nn.Dropout(0.2),
                    nn.Linear(128, 1)
                )
            else:  # classification
                if output_size <= 10:
                    self.head = nn.Sequential(
                        nn.Dropout(0.3),
                        nn.Linear(self.feature_dim, output_size)
                    )
                else:
                    self.head = nn.Sequential(
                        nn.Dropout(0.4),
                        nn.Linear(self.feature_dim, 256),
                        nn.ReLU(),
                        nn.BatchNorm1d(256),
                        nn.Dropout(0.3),
                        nn.Linear(256, output_size)
                    )
        
        def forward(self, x):
            # Extract features
            features = self.backbone(x)
            features = features.view(features.size(0), -1)
            
            # Prediction
            output = self.head(features)
            
            if self.model_type == 'regression':
                output = output.squeeze()
            
            return output

    class EnhancedRegressionModel(nn.Module):
        """
        Enhanced regression model for weight prediction (requires height input).
        """
        def __init__(self, additional_features=1):
            super(EnhancedRegressionModel, self).__init__()
            
            if TORCHVISION_AVAILABLE:
                self.backbone = models.resnet18(pretrained=False)
                self.backbone = nn.Sequential(*list(self.backbone.children())[:-1])
                backbone_features = 512
            else:
                self.backbone = nn.Sequential(
                    nn.Conv2d(3, 64, kernel_size=3, padding=1),
                    nn.ReLU(inplace=True),
                    nn.MaxPool2d(kernel_size=2, stride=2),
                    nn.Conv2d(64, 128, kernel_size=3, padding=1),
                    nn.ReLU(inplace=True),
                    nn.MaxPool2d(kernel_size=2, stride=2),
                    nn.Conv2d(128, 256, kernel_size=3, padding=1),
                    nn.ReLU(inplace=True),
                    nn.AdaptiveAvgPool2d((1, 1))
                )
                backbone_features = 256
            
            # Combined classifier with additional features
            combined_dim = backbone_features + additional_features
            self.regressor = nn.Sequential(
                nn.Dropout(0.3),
                nn.Linear(combined_dim, 256),
                nn.ReLU(inplace=True),
                nn.BatchNorm1d(256),
                nn.Dropout(0.2),
                nn.Linear(256, 128),
                nn.ReLU(inplace=True),
                nn.Linear(128, 1)
            )
        
        def forward(self, image, additional_data):
            image_features = self.backbone(image)
            image_features = image_features.view(image_features.size(0), -1)
            combined = torch.cat([image_features, additional_data], dim=1)
            return self.regressor(combined).squeeze()

else:
    # Dummy classes when PyTorch is not available
    class SimpleFC25Model:
        def __init__(self, *args, **kwargs):
            pass
    
    class EnhancedRegressionModel:
        def __init__(self, *args, **kwargs):
            pass

class PlayerParameterPredictor:
    """
    Unified predictor class that can use either PyTorch models or mock predictions.
    Automatically detects available models and parameter ranges from configuration.
    """
    
    def __init__(self):
        self.parameter_ranges = self._load_parameter_ranges()
        self.available_models = self._scan_available_models()
        self.pytorch_available = self._check_pytorch_availability()
        self.loaded_models = {}
        
        logger.info(f"FC Faces Predictor initialized with {len(self.available_models)} models")
        logger.info(f"PyTorch available: {self.pytorch_available}")
        if PYTORCH_AVAILABLE:
            logger.info(f"TorchVision available: {TORCHVISION_AVAILABLE}")
        logger.info(f"Available parameters: {', '.join(self.available_models)}")
        logger.info(f"Parameter ranges loaded: {len(self.parameter_ranges)} parameters")
    
    def _load_parameter_ranges(self) -> Dict[str, Dict[str, Any]]:
        """Load parameter ranges and class information from JSON file."""
        try:
            if PARAMETER_RANGES_FILE.exists():
                with open(PARAMETER_RANGES_FILE, 'r', encoding='utf-8') as f:
                    ranges = json.load(f)
                logger.info(f"Loaded parameter ranges for {len(ranges)} parameters from {PARAMETER_RANGES_FILE}")
                return ranges
            else:
                logger.warning(f"Parameter ranges file not found: {PARAMETER_RANGES_FILE}")
                return {}
        except Exception as e:
            logger.error(f"Error loading parameter ranges: {e}")
            return {}
    
    def _check_pytorch_availability(self) -> bool:
        """Check if PyTorch is properly available."""
        return PYTORCH_AVAILABLE
    
    def _scan_available_models(self) -> List[str]:
        """Scan models directory for available parameter models."""
        available = []
        
        if not MODELS_DIR.exists():
            logger.warning(f"Models directory not found: {MODELS_DIR}")
            return available
        
        # Pattern to extract parameter name from model filename
        model_pattern = re.compile(r'model_([a-zA-Z0-9_]+)_.*\.pth$')
        
        for model_file in MODELS_DIR.glob("*.pth"):
            match = model_pattern.match(model_file.name)
            if match:
                parameter_name = match.group(1)
                if parameter_name in self.parameter_ranges:
                    available.append(parameter_name)
                    logger.info(f"Found model for parameter: {parameter_name}")
                else:
                    logger.warning(f"Model found but no parameter range defined: {parameter_name}")
        
        return available
    
    def _load_model(self, parameter_name: str) -> Optional[nn.Module]:
        """Load FC Faces PyTorch model for specific parameter."""
        if not self.pytorch_available:
            return None
            
        model_file = MODELS_DIR / f"model_{parameter_name}_best.pth"
        
        if not model_file.exists():
            logger.warning(f"Model file not found: {model_file}")
            return None
        
        try:
            # Load FC Faces checkpoint with weights_only=False for compatibility
            checkpoint = torch.load(model_file, map_location=DEVICE, weights_only=False)
            
            # Extract model information from checkpoint
            param_name = checkpoint.get('param_name', parameter_name)
            param_stats = checkpoint.get('param_stats', {})
            num_classes = checkpoint.get('num_classes', 1)
            is_regression = param_stats.get('is_regression', False)
            
            # Check if this is a weight model (requires height input)
            if parameter_name == 'weight':
                model = EnhancedRegressionModel(additional_features=1)
            else:
                # Create FC Faces model with exact architecture from TEST.py
                model_type = 'regression' if is_regression else 'classification'
                model = SimpleFC25Model(
                    output_size=num_classes,
                    model_type=model_type
                )
            
            # Load state dict
            model.load_state_dict(checkpoint['model_state_dict'])
            model.to(DEVICE)
            model.eval()
            
            logger.info(f"Loaded FC Faces model for {param_name} - {model_type} with {num_classes} {'classes' if not is_regression else 'output'}")
            return model
            
        except Exception as e:
            logger.error(f"Error loading FC Faces model for {parameter_name}: {e}")
            logger.debug(f"Checkpoint keys: {list(checkpoint.keys()) if 'checkpoint' in locals() else 'Failed to load checkpoint'}")
            return None
    
    def predict_parameter(self, image_path: str, parameter_name: str) -> Optional[str]:
        """
        Predict specific parameter from player photo.
        Uses PyTorch model if available, otherwise falls back to mock prediction.
        """
        if parameter_name not in self.available_models:
            return None
        
        param_info = self.parameter_ranges.get(parameter_name, {})
        if not param_info:
            return None
        
        # Try PyTorch prediction first
        if self.pytorch_available and parameter_name not in self.loaded_models:
            self.loaded_models[parameter_name] = self._load_model(parameter_name)
        
        if (self.pytorch_available and 
            parameter_name in self.loaded_models and 
            self.loaded_models[parameter_name] is not None):
            
            try:
                return self._predict_with_pytorch(image_path, parameter_name)
            except Exception as e:
                logger.warning(f"PyTorch prediction failed for {parameter_name}, falling back to mock: {e}")
        
        # Fall back to mock prediction
        return self._predict_with_mock(image_path, parameter_name)
    
    def _predict_with_pytorch(self, image_path: str, parameter_name: str) -> str:
        """Predict using FC Faces PyTorch model."""
        if not PYTORCH_AVAILABLE or Image is None:
            return self._predict_with_mock(image_path, parameter_name)
        
        try:
            model = self.loaded_models[parameter_name]
            
            # Load and preprocess image (FC Faces uses 180x180, exact from TEST.py)
            image = Image.open(image_path).convert('RGB')
            input_tensor = TRANSFORM(image).unsqueeze(0).to(DEVICE)
            
            # Get model checkpoint info for proper prediction handling
            model_file = MODELS_DIR / f"model_{parameter_name}_best.pth"
            checkpoint = torch.load(model_file, map_location='cpu', weights_only=False)
            param_stats = checkpoint.get('param_stats', {})
            is_regression = param_stats.get('is_regression', False)
            
            # Predict
            with torch.no_grad():
                if parameter_name == 'weight':
                    # Weight model requires height - for now use average height
                    # TODO: Get actual height from player data
                    height_tensor = torch.tensor([[175.0]], dtype=torch.float32).to(DEVICE)
                    output = model(input_tensor, height_tensor)
                    prediction = output.item()
                    return str(int(round(prediction)))
                else:
                    output = model(input_tensor)
                    
                    if is_regression:
                        # Regression output
                        prediction = output.item()
                        return str(int(round(prediction)))
                    else:
                        # Classification output (exact logic from TEST.py)
                        probabilities = torch.softmax(output, dim=1)
                        predicted_class_idx = torch.argmax(probabilities, dim=1).item()
                        confidence = probabilities[0, predicted_class_idx].item()
                        
                        # Convert class index back to real value using label mapping (from TEST.py)
                        label_mapping = checkpoint.get('label_mapping', {})
                        if label_mapping and not param_stats.get('is_regression', False):
                            # Create reverse mapping (class_idx -> real_value)
                            reverse_mapping = {}
                            for real_val, class_idx in label_mapping.items():
                                if class_idx != -1:  # Skip invalid mappings
                                    reverse_mapping[class_idx] = real_val
                            
                            # Get the real label
                            predicted_label = reverse_mapping.get(predicted_class_idx, str(predicted_class_idx))
                        else:
                            predicted_label = str(predicted_class_idx)
                        
                        # Store confidence for logging
                        if hasattr(self, '_last_confidences'):
                            self._last_confidences[parameter_name] = confidence
                        else:
                            self._last_confidences = {parameter_name: confidence}
                        
                        return str(predicted_label)
        
        except Exception as e:
            logger.warning(f"FC Faces PyTorch prediction failed for {parameter_name}: {e}")
            # Fallback to mock if PyTorch prediction fails
            return self._predict_with_mock(image_path, parameter_name)
    
    def _predict_with_mock(self, image_path: str, parameter_name: str) -> str:
        """Generate mock prediction based on parameter ranges with weighted distribution."""
        param_info = self.parameter_ranges[parameter_name]
        values = param_info.get('values', [1])
        value_counts = param_info.get('value_counts', {})
        
        # Use weighted random selection based on actual data distribution
        if value_counts:
            choices = list(value_counts.keys())
            weights = list(value_counts.values())
            predicted_value = random.choices(choices, weights=weights, k=1)[0]
        else:
            # Simple random selection from available values
            predicted_value = str(random.choice(values))
        
        return predicted_value
    
    def _get_image_hash(self, image_path: str) -> str:
        """Generate hash of image file content ONLY for deterministic predictions."""
        try:
            with open(image_path, 'rb') as f:
                # Read file in chunks to handle large images efficiently
                file_hash = hashlib.md5()
                chunk = f.read(8192)
                while chunk:
                    file_hash.update(chunk)
                    chunk = f.read(8192)
                
                # Only use file content, NOT filename - for true deterministic behavior
                return file_hash.hexdigest()
        except Exception as e:
            logger.warning(f"Could not hash image {image_path}: {e}")
            # Fallback to a fixed hash to ensure consistent behavior
            return "00000000"
    
    def predict_all_parameters(self, image_path: str) -> Dict[str, str]:
        """
        Predict all available parameters from player photo.
        """
        predictions = {}
        
        for parameter_name in self.available_models:
            predicted_value = self.predict_parameter(image_path, parameter_name)
            if predicted_value is not None:
                predictions[parameter_name] = predicted_value
        
        return predictions
    
    def get_available_parameters(self) -> List[str]:
        """Get list of parameters for which models are available."""
        return self.available_models.copy()

# Global predictor instance
_predictor_instance = None

def get_predictor() -> PlayerParameterPredictor:
    """Get or create the global predictor instance."""
    global _predictor_instance
    if _predictor_instance is None:
        _predictor_instance = PlayerParameterPredictor()
    return _predictor_instance

async def predict_player_parameters_from_photo(image_path: str, parameters: Optional[List[str]] = None) -> Dict[str, str]:
    """
    Async function to predict player parameters from photo.
    
    Args:
        image_path: Path to player photo
        parameters: List of specific parameters to predict (None for all available)
        
    Returns:
        Dictionary mapping parameter names to predicted values
    """
    predictor = get_predictor()
    
    if parameters is None:
        # Predict all available parameters
        return await asyncio.to_thread(predictor.predict_all_parameters, image_path)
    else:
        # Predict specific parameters
        predictions = {}
        for param in parameters:
            if param in predictor.available_models:
                predicted_value = await asyncio.to_thread(predictor.predict_parameter, image_path, param)
                if predicted_value is not None:
                    predictions[param] = predicted_value
        return predictions

async def enhance_player_data_with_predictions(player_data: Dict[str, Any], image_path: str) -> Dict[str, Any]:
    """
    Enhance player data dictionary with ML predictions from photo.
    
    Args:
        player_data: Existing player data dictionary
        image_path: Path to player photo
        
    Returns:
        Enhanced player data with ML predictions
    """
    if not os.path.exists(image_path):
        return player_data
    
    try:
        # Get predictions for all available parameters
        predictions = await predict_player_parameters_from_photo(image_path)
        
        # Update player data with ML predictions, overriding existing values
        enhanced_data = player_data.copy()
        updated_params = []
        
        for param_name, predicted_value in predictions.items():
            # Skip height prediction if player already has height data
            if param_name == "height":
                existing_height = enhanced_data.get("height", "0")
                # Skip if height is already set (not 0 or empty)
                if existing_height and existing_height != "0" and str(existing_height).strip():
                    updated_params.append({
                        "parameter": param_name,
                        "old_value": existing_height,
                        "new_value": existing_height,
                        "skipped": True
                    })
                    continue
            
            # Apply ML predictions for other parameters or height when not set
            old_value = enhanced_data.get(param_name, "0")
            enhanced_data[param_name] = predicted_value
            updated_params.append({
                "parameter": param_name,
                "old_value": old_value,
                "new_value": predicted_value
            })
        
        # Выводим детальную информацию о всех предсказаниях
        if predictions:
            predictor = get_predictor()
            mode = "FC Faces PyTorch" if predictor.pytorch_available else "Mock"
            print(f"        🤖 ML анализ выполнен для {len(predictions)} параметров ({mode}):")
            
            for param_info in updated_params:
                param_name = param_info["parameter"]
                old_value = param_info["old_value"]
                new_value = param_info["new_value"]
                
                # Получаем confidence если доступен
                confidence_str = ""
                if predictor.pytorch_available and hasattr(predictor, '_last_confidences') and param_name in predictor._last_confidences:
                    confidence = predictor._last_confidences[param_name]
                    confidence_str = f" (уверенность: {confidence*100:.1f}%)"
                
                if param_info.get('skipped', False):
                    print(f"           ⏭️  {param_name}: пропущен - уже установлен ({old_value})")
                elif old_value != new_value:
                    print(f"           📊 {param_name}: применено значение {new_value} (было: {old_value}){confidence_str}")
                else:
                    print(f"           📊 {param_name}: применено значение {new_value}{confidence_str}")
        else:
            print(f"        🤖 ML анализ выполнен (модели недоступны)")
        
        return enhanced_data
        
    except Exception as e:
        print(f"        ❌ Ошибка ML предсказания: {str(e)}")
        return player_data

# FastAPI endpoints
@router.get("/player-parameters/available-models", tags=["player-parameters"])
async def get_available_models():
    """Get list of available parameter prediction models."""
    predictor = get_predictor()
    return {
        "available_parameters": predictor.get_available_parameters(),
        "pytorch_available": predictor.pytorch_available,
        "total_parameters": len(predictor.parameter_ranges)
    }

@router.get("/player-parameters/parameter-info/{parameter_name}", tags=["player-parameters"])
async def get_parameter_info(parameter_name: str):
    """Get detailed information about a specific parameter."""
    predictor = get_predictor()
    
    if parameter_name not in predictor.parameter_ranges:
        raise HTTPException(status_code=404, detail=f"Parameter '{parameter_name}' not found")
    
    param_info = predictor.parameter_ranges[parameter_name]
    return {
        "parameter_name": parameter_name,
        "has_model": parameter_name in predictor.available_models,
        "info": param_info
    }

@router.post("/player-parameters/predict", tags=["player-parameters"])
async def predict_parameters(image_path: str, parameters: Optional[List[str]] = None):
    """Predict player parameters from image."""
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image file not found")
    
    try:
        predictions = await predict_player_parameters_from_photo(image_path, parameters)
        return {
            "image_path": image_path,
            "predictions": predictions,
            "total_predictions": len(predictions)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")