import os
from typing import List, Tuple
from PIL import Image
import numpy as np
from collections import Counter
import colorsys
from sklearn.cluster import KMeans

# Parameters for color extraction
NUM_COLORS = 5
TRANSPARENT_THRESHOLD = 200

def is_grayscale(color, threshold=30):
    """Check if a color is grayscale (r, g, b values are close to each other)"""
    r, g, b = color
    return (abs(r - g) < threshold and abs(r - b) < threshold and abs(g - b) < threshold)

def is_dark_color(color, threshold=100):
    """Check if a color is dark based on average RGB value"""
    r, g, b = color
    return (r + g + b) / 3 < threshold

def is_bright_color(color, threshold=200):
    """Check if a color is bright based on average RGB value"""
    r, g, b = color
    return (r + g + b) / 3 > threshold

def sort_colors_by_importance(colors):
    """Sort colors by importance - primary color first, then secondary, then accent"""
    if len(colors) <= 1:
        return colors
    
    # Create a list of (color, score) tuples
    scored_colors = []
    
    for color in colors:
        # Skip white, near-white, black, and near-black colors for primary position
        if is_bright_color(color, 220) or is_dark_color(color, 50) or is_grayscale(color):
            score = 0  # Low score for whites/blacks/grays
        else:
            # Calculate color "vibrancy" as saturation * value in HSV
            r, g, b = color
            h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
            score = s * v  # Higher score for more vibrant colors
        
        scored_colors.append((color, score))
    
    # Sort by score
    scored_colors.sort(key=lambda x: x[1], reverse=True)
    
    # Extract just the colors
    sorted_colors = [color for color, _ in scored_colors]
    
    return sorted_colors

def extract_dominant_colors(image_path: str, n_colors=NUM_COLORS) -> List[Tuple[int, int, int]]:
    """Extract dominant colors from an image using K-means clustering"""
    try:
        # Check file exists
        if not os.path.exists(image_path):
            print(f"Error: Image file does not exist: {image_path}")
            return [(0, 0, 0)]
            
        # Load image
        img = Image.open(image_path).convert('RGBA')
        img_array = np.array(img)
        
        # Filter out transparent pixels
        alpha_channel = img_array[:, :, 3]
        mask = alpha_channel > TRANSPARENT_THRESHOLD
        
        # Get RGB values for non-transparent pixels
        rgb_values = img_array[mask][:, :3]
        
        if len(rgb_values) == 0:
            # If no non-transparent pixels, return black
            return [(0, 0, 0)]
        
        # Reshape for K-means
        pixels = rgb_values.reshape(-1, 3)
        
        # Take a sample if there are too many pixels to process
        max_pixels = 10000
        if len(pixels) > max_pixels:
            indices = np.random.choice(len(pixels), max_pixels, replace=False)
            pixels = pixels[indices]
        
        # Cluster the colors with K-means
        kmeans = KMeans(n_clusters=n_colors, random_state=42, n_init=10)
        kmeans.fit(pixels)
        
        # Get the dominant colors
        colors = kmeans.cluster_centers_.astype(int)
        
        # Get count of pixels in each cluster
        labels = kmeans.labels_
        counts = np.bincount(labels)
        
        # Sort colors by frequency
        colors_with_counts = [(tuple(color), count) for color, count in zip(colors, counts)]
        colors_with_counts.sort(key=lambda x: x[1], reverse=True)
        
        # Extract just the colors
        sorted_colors = [color for color, _ in colors_with_counts]
        
        # Sort by importance (vibrancy, excluding whites/blacks)
        sorted_colors = sort_colors_by_importance(sorted_colors)
        
        return sorted_colors[:3]  # Return top 3 colors
    
    except Exception as e:
        print(f"Error extracting colors from {image_path}: {e}")
        return [(0, 0, 0)]
