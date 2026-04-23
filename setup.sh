#!/usr/bin/env bash
set -euo pipefail

# ── Loom setup ───────────────────────────────────────────────
# Checks dependencies, creates a venv, installs Loom, and gets
# you ready to launch. Safe to re-run.

cd "$(dirname "$0")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
step() { echo -e "\n${BOLD}$1${NC}"; }

NEED_PYTHON=0
NEED_OLLAMA=0
INSTALLED_PYTHON=0

echo ""
echo -e "${BOLD}Loom — setup${NC}"

# ── Detect package manager ───────────────────────────────────

PKG=""
if command -v apt-get &>/dev/null; then
    PKG="apt"
elif command -v dnf &>/dev/null; then
    PKG="dnf"
elif command -v pacman &>/dev/null; then
    PKG="pacman"
elif command -v brew &>/dev/null; then
    PKG="brew"
fi

install_pkg() {
    case "$PKG" in
        apt)    sudo apt-get install -y "$@" ;;
        dnf)    sudo dnf install -y "$@" ;;
        pacman) sudo pacman -S --noconfirm "$@" ;;
        brew)   brew install "$@" ;;
        *)      return 1 ;;
    esac
}

# ── Python 3.11+ ────────────────────────────────────────────

step "Checking Python..."

check_python_version() {
    local py="$1"
    local ver
    ver=$("$py" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null) || return 1
    local major minor
    major=$(echo "$ver" | cut -d. -f1)
    minor=$(echo "$ver" | cut -d. -f2)
    if [ "$major" -ge 3 ] && [ "$minor" -ge 11 ]; then
        echo "$ver"
        return 0
    fi
    return 1
}

PYTHON=""
for candidate in python3 python3.13 python3.12 python3.11; do
    if ver=$(check_python_version "$candidate" 2>/dev/null); then
        PYTHON="$candidate"
        ok "Found $candidate ($ver)"
        break
    fi
done

if [ -z "$PYTHON" ]; then
    if command -v python3 &>/dev/null; then
        cur=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null || echo "unknown")
        fail "Python $cur found, but Loom needs 3.11+"
    else
        fail "Python not found"
    fi

    case "$PKG" in
        apt)
            warn "Installing python3 via apt..."
            sudo apt-get update -qq
            install_pkg python3 python3-pip python3-venv
            INSTALLED_PYTHON=1
            ;;
        dnf)
            warn "Installing python3 via dnf..."
            install_pkg python3 python3-pip
            INSTALLED_PYTHON=1
            ;;
        pacman)
            warn "Installing python via pacman..."
            install_pkg python python-pip
            INSTALLED_PYTHON=1
            ;;
        brew)
            warn "Installing python via brew..."
            install_pkg python@3.12
            INSTALLED_PYTHON=1
            ;;
        *)
            echo ""
            echo "  Please install Python 3.11+ manually, then re-run this script."
            echo "  https://www.python.org/downloads/"
            exit 1
            ;;
    esac

    # Re-check
    for candidate in python3 python3.13 python3.12 python3.11; do
        if ver=$(check_python_version "$candidate" 2>/dev/null); then
            PYTHON="$candidate"
            ok "Installed $candidate ($ver)"
            break
        fi
    done

    if [ -z "$PYTHON" ]; then
        fail "Python 3.11+ still not available after install attempt."
        echo "  Please install manually: https://www.python.org/downloads/"
        exit 1
    fi
fi

# ── venv module ──────────────────────────────────────────────

step "Checking venv..."

if ! "$PYTHON" -m venv --help &>/dev/null; then
    warn "venv module missing"
    case "$PKG" in
        apt)
            warn "Installing python3-venv..."
            install_pkg python3-venv
            ;;
        *)
            fail "Could not find the venv module. Install python3-venv and re-run."
            exit 1
            ;;
    esac
fi
ok "venv available"

# ── Create venv + install ────────────────────────────────────

step "Setting up Loom..."

if [ ! -d .venv ]; then
    "$PYTHON" -m venv .venv
    ok "Created virtual environment (.venv)"
else
    ok "Virtual environment exists"
fi

.venv/bin/pip install --upgrade pip -q 2>/dev/null || true
.venv/bin/pip install -e . -q
ok "Loom installed"

# ── Config ───────────────────────────────────────────────────

step "Config..."

if [ ! -f config.toml ]; then
    cp config.example.toml config.toml
    ok "Created config.toml from template"
else
    ok "config.toml already exists"
fi

# ── Ollama ───────────────────────────────────────────────────

step "Checking Ollama..."

if command -v ollama &>/dev/null; then
    ok "Ollama installed"
    if curl -sf http://127.0.0.1:11434/api/tags &>/dev/null; then
        ok "Ollama is running"
        MODEL_COUNT=$(curl -sf http://127.0.0.1:11434/api/tags | "$PYTHON" -c "import sys,json; print(len(json.load(sys.stdin).get('models',[])))" 2>/dev/null || echo "0")
        if [ "$MODEL_COUNT" -gt 0 ]; then
            ok "$MODEL_COUNT model(s) available"
        else
            warn "No models pulled yet. Grab one:"
            echo "    ollama pull qwen3:8b"
        fi
    else
        warn "Ollama installed but not running"
        echo "    Start it with: ollama serve"
    fi
else
    warn "Ollama not found"
    echo ""
    echo "  Loom talks to a local LLM through Ollama."
    echo "  Install it (one line):"
    echo ""
    echo "    curl -fsSL https://ollama.com/install.sh | sh"
    echo ""
    echo "  Then pull a model:"
    echo ""
    echo "    ollama pull qwen3:8b"
    NEED_OLLAMA=1
fi

# ── Done ─────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}Setup complete.${NC}"
echo ""

if [ "$NEED_OLLAMA" -eq 1 ]; then
    echo -e "  ${DIM}After installing Ollama and pulling a model:${NC}"
    echo ""
fi

echo "  Start Loom:"
echo ""
echo -e "    ${BOLD}.venv/bin/loom${NC}"
echo ""
echo -e "  ${DIM}Or activate the venv first:${NC}"
echo -e "    ${DIM}source .venv/bin/activate${NC}"
echo -e "    ${DIM}loom${NC}"
echo ""
