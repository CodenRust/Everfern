#!/bin/bash

# ============================================================
#  EverFern ShowUI Universal Installer — Unix / WSL
#  Works on: macOS, Linux, WSL2 (Ubuntu/Debian)
# ============================================================

SHOWUI_DIR="$HOME/ShowUI"
VENV_DIR="venv_wsl"
PYTHON_VERSION="3.12"

echo ""
echo " +====================================================+"
echo " |    EverFern ShowUI Installer — Unix / WSL          |"
echo " +====================================================+"
echo ""
echo "EVERFERN_PROGRESS:5"
echo "[EverFern] Destination: $SHOWUI_DIR"

# ── Detect if we're running inside WSL ──────────────────────
IS_WSL=false
if grep -qEi "(microsoft|wsl)" /proc/version 2>/dev/null; then
    IS_WSL=true
    echo "[EverFern] Detected WSL environment"
fi

# ── Auto-install system deps if in WSL/Debian/Ubuntu ────────
if $IS_WSL || [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "[EverFern] Checking system packages..."
    export DEBIAN_FRONTEND=noninteractive

    if command -v apt-get &>/dev/null; then
        echo "[EverFern] Running apt-get update & installing essentials..."
        sudo apt-get update -qq 2>/dev/null || true
        sudo apt-get install -y -qq \
            git curl build-essential \
            python3.12 python3.12-venv python3.12-dev python3-pip 2>/dev/null || \
        sudo apt-get install -y -qq \
            git curl build-essential \
            python3 python3-venv python3-dev python3-pip 2>/dev/null || true
    fi
fi

echo "EVERFERN_PROGRESS:15"

# ── 1. Install uv ────────────────────────────────────────────
echo "EVERFERN_PROGRESS:20"
echo "[EverFern] Installing 'uv' (Ultra-fast Rust package manager)..."
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

if ! command -v uv &>/dev/null; then
    echo "[EverFern] ERROR: Failed to install 'uv'. Please check your internet connection."
    exit 1
fi
echo "[EverFern] uv installed: $(uv --version)"
echo "EVERFERN_PROGRESS:30"

# ── 2. Clone repo ────────────────────────────────────────────
if [ ! -d "$SHOWUI_DIR" ]; then
    echo "[EverFern] Cloning ShowUI repository..."
    git clone https://github.com/showlab/ShowUI.git "$SHOWUI_DIR" || {
        echo "[EverFern] ERROR: git clone failed."
        exit 1
    }
else
    echo "[EverFern] Repo already present — skipping clone"
fi
echo "EVERFERN_PROGRESS:40"

cd "$SHOWUI_DIR" || {
    echo "[EverFern] ERROR: Cannot cd into $SHOWUI_DIR"
    exit 1
}

# ── 3. Create virtual environment ────────────────────────────
echo "EVERFERN_PROGRESS:50"
if [ ! -d "$VENV_DIR" ]; then
    echo "[EverFern] Creating virtual environment with Python $PYTHON_VERSION..."
    uv venv "$VENV_DIR" --python "$PYTHON_VERSION" || {
        echo "[EverFern] WARNING: Python $PYTHON_VERSION not found, trying system python3..."
        uv venv "$VENV_DIR" || {
            echo "[EverFern] ERROR: Failed to create virtual environment."
            exit 1
        }
    }
else
    echo "[EverFern] Virtual environment already exists — using existing."
fi

# Resolve the venv python & pip executables
VENV_PYTHON="$SHOWUI_DIR/$VENV_DIR/bin/python3"
VENV_PIP="$SHOWUI_DIR/$VENV_DIR/bin/pip"

if [ ! -f "$VENV_PYTHON" ]; then
    echo "[EverFern] ERROR: venv python not found at $VENV_PYTHON"
    exit 1
fi
echo "[EverFern] Using Python: $($VENV_PYTHON --version)"

# ── 4. Install dependencies ──────────────────────────────────
echo "EVERFERN_PROGRESS:60"
echo "[EverFern] Pre-installing setuptools and wheel into venv (required by deepspeed)..."
uv pip install \
    --python "$VENV_PYTHON" \
    "setuptools<82" \
    wheel || {
    echo "[EverFern] ERROR: Failed to pre-install setuptools/wheel."
    exit 1
}

echo "[EverFern] Pre-installing torch and numpy (required by build dependencies)..."
uv pip install \
    --python "$VENV_PYTHON" \
    torch numpy || {
    echo "[EverFern] ERROR: Failed to pre-install torch/numpy."
    exit 1
}

echo "[EverFern] Removing vllm (requires CUDA toolkit to compile, not used by ShowUI)..."
sed -i '/^vllm/Id' requirements.txt

echo "[EverFern] Installing base requirements from requirements.txt..."
uv pip install \
    --python "$VENV_PYTHON" \
    -r requirements.txt \
    --no-build-isolation || {
    echo "[EverFern] ERROR: Failed to install requirements.txt"
    exit 1
}

echo "EVERFERN_PROGRESS:70"
echo "[EverFern] Installing Gradio, Spaces, torchvision, torchaudio, accelerate..."
uv pip install \
    --python "$VENV_PYTHON" \
    gradio \
    spaces \
    torchvision \
    torchaudio || {
    echo "[EverFern] ERROR: Failed to install Gradio / Spaces."
    exit 1
}

# Force-install accelerate separately to ensure it lands in the venv
echo "[EverFern] Force-installing accelerate into venv..."
uv pip install \
    --python "$VENV_PYTHON" \
    --reinstall \
    accelerate || {
    echo "[EverFern] WARNING: accelerate install failed — will patch app.py to not require it."
}

# ── 5. Patch app.py for local execution ──────────────────────
echo "[EverFern] Patching app.py for local stability (disabling HF decorators)..."

# Only patch if not already patched
if grep -q "^import spaces" app.py 2>/dev/null; then
    sed -i 's/^import spaces/# import spaces/' app.py
fi
if grep -q "^@spaces\.GPU" app.py 2>/dev/null; then
    sed -i 's/^@spaces\.GPU/# @spaces.GPU/' app.py
fi
if grep -q "inputs = inputs\.to" app.py 2>/dev/null; then
    sed -i 's/^\(\s*\)inputs = inputs\.to/\1# inputs = inputs.to/' app.py
fi
if grep -q "api_open=False" app.py 2>/dev/null; then
    sed -i 's/api_open=False/api_open=True/' app.py
fi
# Remove device_map argument — it requires `accelerate` and is unnecessary for local CPU/single-GPU use.
if grep -q "device_map" app.py 2>/dev/null; then
    echo "[EverFern] Removing device_map from app.py (not needed for local CPU/GPU)..."
    sed -i 's/,\s*device_map\s*=\s*[^,)]*//' app.py
    sed -i 's/device_map\s*=\s*[^,)]*,\s*//' app.py
fi

# Gradio 6.0: remove theme= from gr.Blocks() using Python (sed can't handle nested parens).
if grep -q "gr.Blocks(" app.py 2>/dev/null; then
    echo "[EverFern] Patching gr.Blocks() for Gradio 6.0 compatibility..."
    "$VENV_PYTHON" -c "
import re
with open('app.py', 'r') as f:
    content = f.read()
# Remove theme=anything(...) — handles leading or trailing comma
content = re.sub(r',\s*theme\s*=\s*[\w.]+\([^)]*\)', '', content)
content = re.sub(r'theme\s*=\s*[\w.]+\([^)]*\)\s*,?\s*', '', content)
# Fix any double closing parens left behind: gr.Blocks(...)) -> gr.Blocks(...)
content = re.sub(r'(gr\.Blocks\([^)]*)\)\)', r'\1)', content)
with open('app.py', 'w') as f:
    f.write(content)
print('[EverFern] Gradio 6.0 theme patch applied.')
"
fi

echo "[EverFern] app.py patched."

# ── 6. Model warm-up / weight download ───────────────────────
echo "EVERFERN_PROGRESS:80"
echo "[EverFern] Downloading and caching model weights (~2B, ~10GB)..."
echo "[EverFern] This may take several minutes on first run — please be patient."
echo "[EverFern] (You may see HF Hub warnings — these are safe to ignore)"

export HF_HUB_ENABLE_HF_TRANSFER=1

"$VENV_PYTHON" -c "
import sys
from transformers import AutoProcessor, Qwen2VLForConditionalGeneration
print('EVERFERN_PROGRESS:82', flush=True)
print('[EverFern] Downloading processor...', flush=True)
AutoProcessor.from_pretrained('showlab/ShowUI-2B', trust_remote_code=True)
print('EVERFERN_PROGRESS:88', flush=True)
print('[EverFern] Downloading model weights (this is the big one ~10GB)...', flush=True)
Qwen2VLForConditionalGeneration.from_pretrained('showlab/ShowUI-2B', trust_remote_code=True)
print('EVERFERN_PROGRESS:94', flush=True)
print('[EverFern] Model weights cached successfully.', flush=True)
" || echo "[EverFern] WARNING: Model warm-up skipped or failed — weights will download on first run."

echo "EVERFERN_PROGRESS:95"

# ── 7. Free port 7860 if already in use ──────────────────────
echo "[EverFern] Checking if port 7860 is in use..."
if fuser 7860/tcp &>/dev/null 2>&1; then
    echo "[EverFern] Port 7860 is occupied — freeing it..."
    fuser -k 7860/tcp || true
    sleep 1
    echo "[EverFern] Port 7860 released."
else
    echo "[EverFern] Port 7860 is free."
fi

# ── 8. Launch app.py ─────────────────────────────────────────
echo "EVERFERN_PROGRESS:98"
echo "[EverFern] ShowUI setup complete — launching Gradio server..."
echo ""
echo " +====================================================+"
echo " |    Launching ShowUI (app.py)                       |"
echo " +====================================================+"
echo ""

exec "$VENV_PYTHON" app.py