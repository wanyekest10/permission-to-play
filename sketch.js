            console.log("🎮 Testing: Starting replay");
        }
    }
}

function togglePresentationMode() {
    presentationMode = !presentationMode;
    showControls = !presentationMode;
    showCamera = !presentationMode;
    
    let cameraElement = document.getElementById('camera');
    if (cameraElement) {
        cameraElement.style.display = showCamera ? 'block' : 'none';
    }
    
    // Hide/show pencil controls
    let pencilControls = document.getElementById('pencil-controls');
    if (pencilControls) {
        pencilControls.style.display = presentationMode ? 'none' : 'block';
    }
    
    console.log(presentationMode ? "🎭 Presentation mode ON" : "🎭 Presentation mode OFF");
}

// =============================================================================
// INITIALIZATION
// =============================================================================

console.log("🎨 Permission to Play - Enhanced Collaborative Drawing Game");
console.log("📖 Controls:");
console.log("   P - Toggle presentation mode");
console.log("   H - Toggle control panel");
console.log("   C - Clear canvas");
console.log("   T - Toggle pencil/hand view");
console.log("   1 - Start game selection (testing)");
console.log("   2 - Start replay (testing)");
console.log("🎮 Make a writing grip with your hands to draw!");
console.log("👋 Wave both hands together for collaborative games!");
console.log("✏️ Pencil visualization: " + (showPencilVisualization ? "ON" : "OFF"));