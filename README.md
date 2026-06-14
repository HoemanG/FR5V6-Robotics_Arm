# FR5 Xiangqi Robot

> **Note:** This repository serves as a comprehensive guide and reference for the secured codebase powering the FR5V6 robotic arm system used in the IoT & AI Lab at FPT University, Can Tho Campus, Vietnam.

Automated Chinese Chess (Xiangqi) playing system using camera + YOLO occupancy detection, Pygame UI, AI engine, and robot manipulator. The runtime is currently implemented for Fairino FR5 with JODELL/ERG gripper via `MoveGripper`, but the robot/camera/gripper/board configuration must be re-setup for each hardware setup.

> The parameters in `config.py` are sample configuration from a current setup. Do not treat camera IP, offset, Z height, gripper position, teaching points, or API tokens as mandatory values for all robots/boards.

---

## 1. What the System Does

```text
Camera / Video Source
        ↓
YOLO occupancy model + perspective transform
        ↓
SnapshotDetector: compares T1 baseline with T2 after SPACE
        ↓
GameState + Xiangqi rules + FEN
        ↓
AI engine → Robot move → update new baseline
```

Main components:

| Component | Role |
|---|---|
| `main.py` | Main loop: UI, input, AI turn, robot turn, baseline update |
| `config.py` | Runtime configuration: camera, robot, gripper, AI, board coordinates |
| `src/core/` | Chess rules, FEN, game state, rollback |
| `src/vision/` | Camera, YOLO inference, perspective, snapshot detection |
| `src/hardware/` | Robot, gripper, hardware manager, Fairino SDK |
| `src/ai/` | Cloud engine, Moonfish local engine, AI controller |
| `src/ui/` | Pygame board, UI buttons, keyboard/mouse input |
| `tests/` | Test scripts/manual tools by module |

---

## 2. Current Directory Structure

```text
fr5_xiangqi_robot/
├── main.py
├── config.py
├── README.md
│
├── assets/
│   ├── models/
│   │   └── best.pt                  # YOLO weight runtime
│   ├── perspective.npy              # Generated after camera calibration
│   ├── videos/                      # Raw video for dataset creation
│   ├── custom_dataset/              # YOLO dataset after label/review
│   ├── debug_outputs/               # YOLO pipeline debug output
│   └── droidcam_outputs/            # Images/video saved from camera UI
│
├── src/
│   ├── ai/
│   ├── api/
│   ├── core/
│   ├── hardware/
│   ├── ui/
│   └── vision/
│
├── tests/
│   ├── 00_camera/
│   ├── 01_yolo_dataset_tools/
│   ├── 02_yolo_pipeline_debug/
│   ├── 03_robot_math/
│   ├── 04_robot_motion_manual/
│   └── 05_gripper_manual/
│
└── moonfish/                         # Local engine if using LOCAL/HYBRID
```

`tools/` has been merged into `tests/`. Temporary scripts for debugging rollback/offset have been deleted.

---

## 3. Environment Setup

### 3.1. Create Python Environment

Conda:

```bash
conda create -n fr5v6 python=3.10 -y
conda activate fr5v6
cd ~/truong_CODE/fr5_xiangqi_robot
```

Venv:

```bash
cd ~/fr5_xiangqi_robot
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
```

### 3.2. Install Dependencies

```bash
pip install numpy opencv-python pygame ultralytics requests pillow
```

If using GPU for YOLO, install PyTorch with the correct CUDA version before running `ultralytics`.

```bash
python - <<'PY'
import torch
print(torch.__version__)
print("cuda:", torch.cuda.is_available())
PY
```

### 3.3. Quick Compile Check

```bash
python -m py_compile main.py config.py
python -m py_compile src/core/game_state.py src/hardware/robot_VIP.py src/hardware/hardware_manager.py
```

---

## 4. Required Assets

### 4.1. YOLO Weights

Default runtime looks for model at:

```text
assets/models/best.pt
```

Verify:

```bash
ls assets/models/best.pt
python - <<'PY'
from ultralytics import YOLO
YOLO("assets/models/best.pt")
print("YOLO model OK")
PY
```

If using different pieces, camera, lighting, or board, you should create your own dataset and retrain the occupancy model.

### 4.2. Perspective Matrix

Camera calibration file:

```text
assets/perspective.npy
```

This file depends on camera position and board placement. When changing camera, viewing angle, board, or resolution, recalibration is required.

4-corner click order:

```text
R1: Black left    = col=0, row=0
R2: Black right   = col=8, row=0
R3: Red right     = col=8, row=9
R4: Red left      = col=0, row=9
```

### 4.3. Local Chess Engine

Local engine is only needed if `ENGINE_TYPE="LOCAL"` or `ENGINE_TYPE="HYBRID"`.

```bash
git clone https://github.com/walker8088/moonfish.git moonfish
```

Current config supports Moonfish Python:

```python
MOONFISH_EXE = "moonfish/moonfish_ucci.py"
MOONFISH_NNUE = None
```

---

## 5. Configuring `config.py`

`config.py` requires the most modifications when switching to different robot/board/camera.

### 5.1. Run Mode

```python
DRY_RUN = True
```

| Value | Meaning |
|---|---|
| `True` | No robot connection. Use for testing UI/rules/AI with mouse. |
| `False` | Real run: camera + YOLO + robot if hardware is ready. |

### 5.2. Camera / Video Source

Current example:

```python
VIDEO_SOURCE = "http://10.64.241.236:4747/video"
VIDEO_BUFFER_SIZE = 1
```

`VIDEO_SOURCE` must be changed to match your actual camera:

```text
0, 1, 2                         # webcam index
"0", "1", "2"                  # webcam index as string
"http://x.x.x.x:4747/video"     # DroidCam/IP camera
"path/to/video.mp4"             # video file for debugging
```

Test camera:

```bash
python tests/00_camera/test_video_source.py --show
```

### 5.3. Robot Network

Example for Fairino FR5:

```python
ROBOT_IP = "192.168.58.2"
```

This value must be changed to your actual controller IP. Check connection:

```bash
ping -c 3 192.168.58.2
nc -vz 192.168.58.2 20003
ip route get 192.168.58.2
```

If Linux route goes through Docker bridge, change Docker subnet or remove conflicting network. Avoid having Docker use the same subnet as the robot.

### 5.4. Board Coordinate Fallback

Logical board:

```text
col = 0..8
row = 0..9
R1 = (0,0), R2 = (8,0), R3 = (8,9), R4 = (0,9)
```

Current fallback config:

```python
ROBOT_COL_TO_X_SIGN = 1
ROBOT_ROW_TO_Y_SIGN = -1
CELL_SIZE_COL_MM = 326.0 / 8.0
CELL_SIZE_ROW_MM = (370.0 - 2.0) / 9.0
```

These values are only backup scalars when teaching points are missing. The primary method uses bilinear interpolation from R1/R2/R3/R4. For different boards, measure dimensions again or verify using teaching points.

### 5.5. Piece Pickup Offset

Example:

```python
OFFSET_X = 4.0
OFFSET_Y = 0.0
```

Meaning in current setup:

```text
Positive OFFSET_X: shift toward positive robot X, closer to R2/R3 area
Negative OFFSET_X: shift toward negative robot X, closer to R1/R4 area
Positive OFFSET_Y: shift toward positive robot Y, closer to robot
Negative OFFSET_Y: shift toward negative robot Y, farther from robot
```

`OFFSET_X/Y` is offset in robot/work object coordinates, not camera pixels and not local gripper. Each board, TCP, gripper, and board orientation may require retuning.

### 5.6. Z Height and TCP Orientation

```python
SAFE_Z  = 286.869
PICK_Z  = 181.477
PLACE_Z = 190.0
ROTATION = [-180.0, 0.0, -180.0]
```

These values depend on:

```text
- table height
- piece height
- gripper/finger length
- TCP/tool frame
- safe clearance needed when robot moves over the board
```

Recommended tuning procedure:

```text
1. SAFE_Z high enough to not scrape pieces.
2. PICK_Z just low enough to grip piece, not hitting the board.
3. PLACE_Z low enough to release piece stably, not pressing piece down.
4. ROTATION keeps TCP/gripper orientation matching actual pickup method.
```

### 5.7. Gripper

Current example for JODELL/ERG EPG 040-50 via Fairino `MoveGripper`:

```python
GRIPPER_MODE = "move_gripper"
GRIPPER_ID = 1
GRIPPER_OPEN_POS = 0
GRIPPER_PICK_OPEN_POS = 0
GRIPPER_RELEASE_OPEN_POS = 0
GRIPPER_CLOSE_POS = 38
GRIPPER_SPEED = 40
GRIPPER_FORCE = 40
GRIPPER_MAX_TIME_MS = 3000
GRIPPER_BLOCK = 1
GRIPPER_TYPE = 0
```

General meaning:

| Variable | Meaning |
|---|---|
| `GRIPPER_OPEN_POS` | fully open or default open position |
| `GRIPPER_PICK_OPEN_POS` | opening before lowering to pick, used to avoid hitting adjacent pieces |
| `GRIPPER_RELEASE_OPEN_POS` | opening when releasing piece |
| `GRIPPER_CLOSE_POS` | closing when gripping piece |
| `GRIPPER_SPEED` | open/close speed |
| `GRIPPER_FORCE` | grip force |

For JODELL/ERG EPG 040-50, `pos` usually ranges from `0..100`; larger values mean more closing. For different grippers, this convention may differ and the adapter in `src/hardware/robot_VIP.py` needs modification.

Test gripper:

```bash
python tests/05_gripper_manual/manual_gripper_close_positions.py --dry-run --positions 33 38
python tests/05_gripper_manual/manual_gripper_close_positions.py --real --positions 33 38
```

### 5.8. AI Engine

```python
ENGINE_TYPE = "CLOUD"      # CLOUD, LOCAL, HYBRID
CLOUD_API_URL = "https://tuongkydaisu.com/api/engine/bestmove"
CLOUD_TIMEOUT_SEC = 6
MOONFISH_EXE = "moonfish/moonfish_ucci.py"
MOONFISH_NNUE = None
MOONFISH_THINK_MS = 1000
```

Select mode based on environment:

| Mode | When to Use |
|---|---|
| `CLOUD` | stable internet/API available |
| `LOCAL` | need to run offline |
| `HYBRID` | prefer Cloud, fallback to Local |

### 5.9. Simulation API

```python
SIMULATION_API_URL = "https://tuongkydaisu.com"
SIMULATION_TOKEN = "..."
```

Token must be changed to match real account/server. Do not commit real tokens if repo is public.

---

## 6. Setting Up New Robot/Board

### 6.1. Required Teaching Points

Save 4 points on robot controller:

| Name | Board Cell | Meaning |
|---|---:|---|
| `R1` | `(0,0)` | Black left corner, board origin |
| `R2` | `(8,0)` | Black right corner |
| `R3` | `(8,9)` | Red right corner |
| `R4` | `(0,9)` | Red left corner |

Guidelines:

```text
- TCP placed at cell center.
- Z corresponds to reference height when picking/placing.
- TCP orientation should be consistent across 4 points.
- Runtime still enforces orientation per config.ROTATION when picking/placing on board.
```

After connecting, log should contain:

```text
Loaded R1 ...
Loaded R2 ...
Loaded R3 ...
Loaded R4 ...
COL spacing = ... mm/col
ROW spacing = ... mm/row
Using Bilinear Interpolation for all positions
```

Check spacing/sign:

```bash
python tests/03_robot_math/test_cell_size_from_teaching_points.py
```

### 6.2. Recommended Teaching Points

| Name | Role |
|---|---|
| `HOMECHESS` | Waiting point after each move, avoids blocking camera |
| `R_Trash` | Drop zone for captured pieces |

If `R_Trash` is missing, code falls back to `CAPTURE_BIN_X/Y/Z` in `config.py`.

### 6.3. Manual Motion Test

Only run `--real` after verifying workspace, `SAFE_Z`, TCP orientation, and no obstacles.

```bash
python tests/04_robot_motion_manual/manual_move_center_safe.py --dry-run
python tests/04_robot_motion_manual/manual_move_center_safe.py --real --speed 20

python tests/04_robot_motion_manual/manual_move_board_positions.py --cells 0,0 4,4.5 8,9 --dry-run
python tests/04_robot_motion_manual/manual_move_board_positions.py --cells 4,4.5 --real --speed 20

python tests/04_robot_motion_manual/manual_4_rooks.py --dry-run
python tests/04_robot_motion_manual/manual_4_rooks.py --real --speed 20
```

---

## 7. Data, Label, and Train YOLO

YOLO currently uses occupancy model: only need to detect if piece is present. Piece type/color is derived from board memory/FEN.

### 7.1. Capture Video/Images

Use camera UI:

```bash
python tests/00_camera/droidcam_ui.py
```

Output:

```text
assets/droidcam_outputs/
```

Copy video for dataset creation to:

```text
assets/videos/
```

### 7.2. Auto-label from Video

```bash
python tests/01_yolo_dataset_tools/autolabel_yolo.py
```

Output:

```text
assets/custom_dataset/
  data.yaml
  images/train/*.jpg
  images/val/*.jpg
  labels/train/*.txt
  labels/val/*.txt
```

Useful commands:

```bash
python tests/01_yolo_dataset_tools/autolabel_yolo.py --review-existing
python tests/01_yolo_dataset_tools/autolabel_yolo.py --force
python tests/01_yolo_dataset_tools/autolabel_yolo.py --auto-save
python tests/01_yolo_dataset_tools/autolabel_yolo.py --sample-seconds 1.0
```

In autolabel UI:

```text
s = save + next
a = previous
d = next
r = re-detect
c = clear boxes
q / esc = quit
left drag = add bbox
right click = delete bbox
corner drag = adjust bbox
```

### 7.3. Dataset Stats

```bash
python tests/01_yolo_dataset_tools/dataset_stats.py
python tests/01_yolo_dataset_tools/dataset_stats.py --dataset-dir assets/custom_dataset
```

### 7.4. Train YOLO

Ultralytics example:

```bash
yolo detect train \
  model=yolo11m.pt \
  data=assets/custom_dataset/data.yaml \
  epochs=80 \
  imgsz=640 \
  batch=8 \
  name=xiangqi_occupancy
```

After training:

```bash
mkdir -p assets/models
cp runs/detect/xiangqi_occupancy/weights/best.pt assets/models/best.pt
```

### 7.5. Debug YOLO Pipeline T1/T2

```bash
python tests/02_yolo_pipeline_debug/yolo_pipeline_debug.py \
  --start assets/sample_images/start.JPG \
  --t1 assets/sample_images/t1.JPG \
  --t2 assets/sample_images/t2.JPG
```

Debug video:

```bash
python tests/02_yolo_pipeline_debug/yolo_pipeline_debug.py \
  --video assets/videos/example.mp4 \
  --frame-step 30 \
  --save-video \
  --skip-t1t2
```

Output:

```text
assets/debug_outputs/yolo_pipeline/
```

---

## 8. Running the System

### 8.1. Dry Run

```python
DRY_RUN = True
```

```bash
python main.py
```

In dry run:

```text
- No robot connection.
- No real camera needed.
- Move red pieces with mouse on Pygame UI.
- AI still runs according to configured engine.
```

### 8.2. Real Run

```python
DRY_RUN = False
```

Checklist:

```text
- assets/models/best.pt exists.
- VIDEO_SOURCE accessible via test_video_source.py.
- assets/perspective.npy matches current camera or ready to recalibrate.
- Robot is pingable.
- R1/R2/R3/R4 taught correctly for current board.
- HOMECHESS and R_Trash taught if using real robot.
- Gripper configured and close/open tested OK.
- SAFE_Z/PICK_Z/PLACE_Z tuned safely.
```

Run:

```bash
python main.py
```

---

## 9. Actual Play Flow

### 9.1. T1 and T2

```text
T1 baseline:
    board state before player moves.
    includes _baseline_occ, _baseline_frame, _baseline_time.

T2:
    new image captured after pressing SPACE.
```

Player flow:

```text
1. Player moves red piece on real board.
2. Press SPACE.
3. Camera captures new T2.
4. SnapshotDetector compares T1 with T2.
5. If valid detection: update board/FEN, switch to AI turn.
6. If detection fails: keep T1, remove obstruction/adjust pieces then press SPACE again.
```

Do not clear baseline on YOLO failure. Failure usually due to T2 being obscured/blurry/missed, not because T1 is wrong.

### 9.2. AI/Robot Flow

```text
1. AI receives current FEN.
2. AI returns best move for black pieces.
3. Save rollback checkpoint before robot moves.
4. Robot picks/places piece.
5. If robot succeeds: update board/FEN.
6. Capture new T1 for next player turn.
```

### 9.3. Rollback / Undo

Rollback restores:

```text
- board
- turn
- FEN
- move_history
- selected_pos
- manual_override_active
- game_over/winner
- YOLO T1 baseline: occ/time/frame
```

Button/key:

```text
Z          = rollback when in player turn
UNDO STEP  = rollback via UI
```

Rollback does not automatically fix real board. Physical pieces must be placed back to checkpoint state before pressing SPACE again.

---

## 10. Controls

| Input | Action |
|---|---|
| `SPACE` | Capture T2 and detect player move |
| `Z` | Rollback to nearest checkpoint when in player turn |
| `UNDO STEP` | Rollback via UI |
| `New Game` | Reset new game |
| `Surrender` | Surrender |
| `Q` in camera window | Exit camera/main loop |
| Mouse drag/click | Manual move in dry run or manual override |

---

## 11. Current Test Scripts

| Group | File | Purpose |
|---|---|---|
| Camera | `tests/00_camera/test_video_source.py` | Test `config.VIDEO_SOURCE` |
| Camera | `tests/00_camera/droidcam_ui.py` | Preview/capture DroidCam/IP camera |
| Dataset | `tests/01_yolo_dataset_tools/autolabel_yolo.py` | Create/review YOLO dataset from video |
| Dataset | `tests/01_yolo_dataset_tools/dataset_stats.py` | YOLO dataset statistics |
| YOLO debug | `tests/02_yolo_pipeline_debug/yolo_pipeline_debug.py` | Debug YOLO + T1/T2 snapshot |
| Robot math | `tests/03_robot_math/test_cell_size_from_teaching_points.py` | Check R1-R4 spacing/sign |
| Robot manual | `tests/04_robot_motion_manual/manual_move_center_safe.py` | MoveCart to board center at SAFE_Z |
| Robot manual | `tests/04_robot_motion_manual/manual_move_board_positions.py` | MoveCart to specified cells |
| Robot manual | `tests/04_robot_motion_manual/manual_4_rooks.py` | Check far corners |
| Gripper | `tests/05_gripper_manual/manual_gripper_close_positions.py` | Test MoveGripper positions |

Compile check:

```bash
python -m py_compile \
  tests/00_camera/droidcam_ui.py \
  tests/00_camera/test_video_source.py \
  tests/01_yolo_dataset_tools/autolabel_yolo.py \
  tests/01_yolo_dataset_tools/dataset_stats.py \
  tests/02_yolo_pipeline_debug/yolo_pipeline_debug.py \
  tests/03_robot_math/test_cell_size_from_teaching_points.py \
  tests/04_robot_motion_manual/manual_4_rooks.py \
  tests/04_robot_motion_manual/manual_move_center_safe.py \
  tests/04_robot_motion_manual/manual_move_board_positions.py \
  tests/05_gripper_manual/manual_gripper_close_positions.py
```

---

## 12. Brief Notes on Important Files

### `main.py`

- Main game loop.
- Creates initial T1 baseline after hardware init.
- Runs AI in thread to avoid UI blocking.
- Saves rollback checkpoint before AI/robot move.
- After successful robot move, updates board/FEN and captures new T1.

### `config.py`

- Main runtime configuration source.
- Values requiring change per setup: camera URL, robot IP, Z height, offset, gripper positions, API token.
- `OFFSET_X/Y` used in robot/work object coordinates, not camera pixels.
- `CELL_SIZE_COL_MM/ROW_MM` and sign are only scalar fallback.

### `src/hardware/robot_VIP.py`

- Controls FR5 via Fairino SDK.
- Default gripper uses SDK `MoveGripper`, not ToolDO.
- Board pose primarily uses bilinear interpolation from R1/R2/R3/R4.
- Direct corner teaching points still enforce `config.ROTATION` to keep TCP orientation unified.
- If using different robot or gripper, this file is where the adapter needs rewriting.

### `src/hardware/hardware_manager.py`

- Initializes AI, robot, camera, YOLO model, and `SnapshotDetector`.
- `capture_baseline_if_needed()` creates T1.
- `restore_yolo_baseline()` used for rollback.

### `src/ui/input_handler.py`

- `SPACE`: capture T2, save rollback checkpoint, detect/validate move.
- YOLO failure does not clear T1 baseline.
- Retry with SPACE using old T1 and new T2.
- Successful manual override updates board and recaptures T1.

### `src/core/game_state.py`

- Manages board, FEN, turn, captured pieces, UI status, rollback.
- Rollback saves baseline frame to support capture ambiguity in `SnapshotDetector`.

### `src/vision/snapshot_detector.py`

- Builds occupancy from YOLO detections.
- Compares T1/T2 to find disappeared/appeared cells.
- Uses board memory to know which piece is at source cell.
- Handles capture ambiguity with pixel absdiff when occupancy change is unclear.

### `src/vision/video_source.py`

- Centralized camera/video open function.
- Avoids hard-coding camera in multiple files.

---

## 13. Troubleshooting

### Camera cannot be opened

```bash
python tests/00_camera/test_video_source.py --show
```

Check:

```text
- VIDEO_SOURCE correct URL/index.
- Camera/phone on same network if using IP stream.
- DroidCam/IP webcam app streaming.
- Firewall not blocking.
```

### YOLO cannot determine move

```text
- Check perspective.npy.
- Check if camera is obstructed/blurry.
- Check if pieces are placed at cell center.
- Press SPACE again after removing obstruction.
- No need for New Game if only temporary T2 error.
```

Debug:

```bash
python tests/02_yolo_pipeline_debug/yolo_pipeline_debug.py --start ... --t1 ... --t2 ...
```

### Robot cannot connect

```bash
ping -c 3 <ROBOT_IP>
nc -vz <ROBOT_IP> 20003
ip route get <ROBOT_IP>
```

If route goes through Docker bridge, change Docker subnet or remove conflicting network.

### Gripper error `73` or `14`

```text
- Robot not in command mode.
- Web UI/manual-auto state incorrect.
- Gripper not active or controller not receiving command.
- GRIPPER_ID/TYPE/BLOCK not matching robot controller configuration.
```

### Robot picking misaligned

```text
- Uniform offset in columns/left-right: tune OFFSET_X.
- Uniform offset in rows/front-back: tune OFFSET_Y.
- Non-uniform offset across board: reteach R1/R2/R3/R4.
- Offset per camera/cell detection error: recalibrate perspective.npy.
- Offset at finger tip: check TCP/tool frame and gripper geometry.
```

### Robot scraping adjacent pieces

```text
- Increase SAFE_Z if scraping during lateral movement.
- Tune GRIPPER_PICK_OPEN_POS if fingers open too wide when lowering.
- Tune ROTATION so gripper orientation matches real board setup.
- For wide grippers, use diagonal pickup direction or TCP aligned with gripper center.
```

---

## 14. Setup Checklist for New Robot/Board

```text
1. Create Python env and install dependencies.
2. Set VIDEO_SOURCE to match real camera.
3. Test camera with tests/00_camera/test_video_source.py.
4. Calibrate camera to create assets/perspective.npy.
5. Capture video/images with real camera.
6. Auto-label/review dataset.
7. Train YOLO and copy best.pt to assets/models/best.pt.
8. Set ROBOT_IP to match controller.
9. Teach R1/R2/R3/R4 on robot controller.
10. Teach HOMECHESS and R_Trash if using real robot.
11. Test robot math with tests/03_robot_math/test_cell_size_from_teaching_points.py.
12. Tune SAFE_Z, PICK_Z, PLACE_Z, ROTATION.
13. Tune OFFSET_X/Y.
14. Tune gripper open/pick/close/release positions.
15. Set ENGINE_TYPE and API token if using cloud/simulation.
16. Run python main.py.
```

---

## 15. Git and Security

Do not commit if repo is public:

```text
- Real tokens in config.py
- Large video dataset
- Large training output in runs/
- __pycache__ cache
- Heavy engine binary
```

Keep:

```text
- Source code src/
- README.md
- Cleaned tests/
- Sample config or config with scrubbed tokens
- Sample data.yaml if needed
```