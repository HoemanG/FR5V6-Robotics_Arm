# FR5 Xiangqi Robot

> **Note:** Kho lưu trữ này đóng vai trò là hướng dẫn và tài liệu tham khảo toàn diện cho mã nguồn được bảo mật của hệ thống cánh tay robot FR5V6 được sử dụng trong Phòng thí nghiệm IoT & AI tại Đại học FPT, Cơ sở Cần Thơ, Việt Nam.

Hệ thống robot chơi Cờ Tướng tự động dùng camera + YOLO occupancy detection, Pygame UI, AI engine và robot manipulator. Runtime hiện được triển khai cho Fairino FR5 với gripper JODELL/ERG qua `MoveGripper`, nhưng phần cấu hình robot/camera/gripper/bàn cờ phải được setup lại cho từng bộ phần cứng.

> Các thông số trong `config.py` chỉ là cấu hình mẫu của một setup đang dùng. Không xem các giá trị IP camera, offset, Z height, gripper position, teaching point hay token API là giá trị bắt buộc cho mọi robot/bàn cờ.

---

## 1. Hệ thống làm gì

```text
Camera / Video Source
        ↓
YOLO occupancy model + perspective transform
        ↓
SnapshotDetector: so sánh T1 baseline với T2 sau SPACE
        ↓
GameState + Xiangqi rules + FEN
        ↓
AI engine → Robot move → cập nhật baseline mới
```

Các khối chính:

| Khối | Vai trò |
|---|---|
| `main.py` | Vòng lặp chính: UI, input, AI turn, robot turn, baseline update |
| `config.py` | Cấu hình runtime: camera, robot, gripper, AI, tọa độ bàn |
| `src/core/` | Luật cờ, FEN, trạng thái game, rollback |
| `src/vision/` | Camera, YOLO inference, perspective, snapshot detection |
| `src/hardware/` | Robot, gripper, hardware manager, Fairino SDK |
| `src/ai/` | Cloud engine, Moonfish local engine, AI controller |
| `src/ui/` | Pygame board, nút UI, keyboard/mouse input |
| `tests/` | Script test/manual tools theo module |

---

## 2. Cấu trúc thư mục hiện tại

```text
fr5_xiangqi_robot/
├── main.py
├── config.py
├── README.md
│
├── assets/
│   ├── models/
│   │   └── best.pt                  # YOLO weight runtime
│   ├── perspective.npy              # Sinh sau camera calibration
│   ├── videos/                      # Video thô để tạo dataset
│   ├── custom_dataset/              # Dataset YOLO sau label/review
│   ├── debug_outputs/               # Output debug YOLO pipeline
│   └── droidcam_outputs/            # Ảnh/video lưu từ camera UI
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
└── moonfish/                         # Local engine nếu dùng LOCAL/HYBRID
```

`tools/` đã được gom vào `tests/`. Các script tạm để debug rollback/offset đã được xóa.

---

## 3. Cài đặt môi trường

### 3.1. Tạo môi trường Python

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

### 3.2. Cài dependencies

```bash
pip install numpy opencv-python pygame ultralytics requests pillow
```

Nếu dùng GPU cho YOLO, cài PyTorch đúng CUDA trước khi chạy `ultralytics`.

```bash
python - <<'PY'
import torch
print(torch.__version__)
print("cuda:", torch.cuda.is_available())
PY
```

### 3.3. Compile check nhanh

```bash
python -m py_compile main.py config.py
python -m py_compile src/core/game_state.py src/hardware/robot_VIP.py src/hardware/hardware_manager.py
```

---

## 4. Asset cần chuẩn bị

### 4.1. YOLO weight

Runtime mặc định tìm model tại:

```text
assets/models/best.pt
```

Kiểm tra:

```bash
ls assets/models/best.pt
python - <<'PY'
from ultralytics import YOLO
YOLO("assets/models/best.pt")
print("YOLO model OK")
PY
```

Nếu dùng quân cờ, camera, ánh sáng hoặc bàn khác, nên tự tạo dataset và train lại model occupancy.

### 4.2. Perspective matrix

File calibration camera:

```text
assets/perspective.npy
```

File này phụ thuộc vào vị trí camera và bàn cờ. Khi đổi camera, đổi góc nhìn, đổi bàn hoặc đổi độ phân giải, cần calibrate lại.

Thứ tự click 4 góc:

```text
R1: Đen trái  = col=0, row=0
R2: Đen phải  = col=8, row=0
R3: Đỏ phải   = col=8, row=9
R4: Đỏ trái   = col=0, row=9
```

### 4.3. Local chess engine

Local engine chỉ cần nếu `ENGINE_TYPE="LOCAL"` hoặc `ENGINE_TYPE="HYBRID"`.

```bash
git clone https://github.com/walker8088/moonfish.git moonfish
```

Config hiện hỗ trợ Moonfish Python:

```python
MOONFISH_EXE = "moonfish/moonfish_ucci.py"
MOONFISH_NNUE = None
```

---

## 5. Cấu hình `config.py`

`config.py` là nơi cần chỉnh nhiều nhất khi chuyển sang robot/bàn/camera khác.

### 5.1. Chế độ chạy

```python
DRY_RUN = True
```

| Giá trị | Ý nghĩa |
|---|---|
| `True` | Không connect robot. Dùng để test UI/rules/AI bằng chuột. |
| `False` | Real run: camera + YOLO + robot nếu hardware sẵn sàng. |

### 5.2. Camera / video source

Ví dụ hiện tại:

```python
VIDEO_SOURCE = "http://10.64.218.131:4747/video"
VIDEO_BUFFER_SIZE = 1
```

`VIDEO_SOURCE` phải thay theo camera thực tế:

```text
0, 1, 2                         # webcam index
"0", "1", "2"                  # webcam index dạng string
"http://x.x.x.x:4747/video"     # DroidCam/IP camera
"path/to/video.mp4"             # video file để debug
```

Test camera:

```bash
python tests/00_camera/test_video_source.py --show
```

### 5.3. Robot network

Ví dụ cho Fairino FR5:

```python
ROBOT_IP = "192.168.58.2"
```

Giá trị này phải thay theo IP controller thực tế. Kiểm tra kết nối:

```bash
ping -c 3 192.168.58.2
nc -vz 192.168.58.2 20003
ip route get 192.168.58.2
```

Nếu Linux route đi vào Docker bridge, đổi Docker subnet hoặc xóa network xung đột. Tránh để Docker dùng cùng subnet với robot.

### 5.4. Board coordinate fallback

Bàn logic:

```text
col = 0..8
row = 0..9
R1 = (0,0), R2 = (8,0), R3 = (8,9), R4 = (0,9)
```

Config fallback hiện tại:

```python
ROBOT_COL_TO_X_SIGN = 1
ROBOT_ROW_TO_Y_SIGN = -1
CELL_SIZE_COL_MM = 326.0 / 8.0
CELL_SIZE_ROW_MM = (370.0 - 2.0) / 9.0
```

Các giá trị này chỉ là backup scalar khi thiếu teaching points. Đường chính dùng bilinear interpolation từ R1/R2/R3/R4. Với bàn khác, đo lại kích thước hoặc dựa vào teaching points để verify.

### 5.5. Offset gắp quân

Ví dụ:

```python
OFFSET_X = 4.0
OFFSET_Y = 0.0
```

Ý nghĩa trong setup hiện tại:

```text
OFFSET_X dương: dịch về phía X robot dương, gần vùng R2/R3 hơn
OFFSET_X âm:    dịch về phía X robot âm, gần vùng R1/R4 hơn
OFFSET_Y dương: dịch về phía Y robot dương, gần robot hơn
OFFSET_Y âm:    dịch về phía Y robot âm, xa robot hơn
```

`OFFSET_X/Y` là offset theo robot/work object, không phải pixel camera và không phải local gripper. Mỗi bàn, TCP, gripper, chiều đặt bàn có thể cần tune lại.

### 5.6. Z height và hướng TCP

```python
SAFE_Z  = 286.869
PICK_Z  = 181.477
PLACE_Z = 190.0
ROTATION = [-180.0, 0.0, -180.0]
```

Các giá trị này phụ thuộc vào:

```text
- chiều cao bàn
- chiều cao quân cờ
- chiều dài gripper/finger
- TCP/tool frame
- khoảng hở an toàn cần có khi robot bay qua bàn
```

Quy trình tune khuyến nghị:

```text
1. SAFE_Z đủ cao để không quệt quân.
2. PICK_Z chỉ thấp đủ để kẹp quân, không đập bàn.
3. PLACE_Z đủ thấp để thả quân ổn định, không ép quân xuống bàn.
4. ROTATION giữ hướng TCP/gripper phù hợp với cách gắp thực tế.
```

### 5.7. Gripper

Ví dụ hiện tại dành cho JODELL/ERG EPG 040-50 qua Fairino `MoveGripper`:

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

Ý nghĩa chung:

| Biến | Ý nghĩa |
|---|---|
| `GRIPPER_OPEN_POS` | vị trí mở hoàn toàn hoặc mở mặc định |
| `GRIPPER_PICK_OPEN_POS` | độ mở trước khi hạ xuống gắp, dùng để tránh quệt quân bên cạnh |
| `GRIPPER_RELEASE_OPEN_POS` | độ mở khi thả quân |
| `GRIPPER_CLOSE_POS` | độ đóng khi gắp quân |
| `GRIPPER_SPEED` | tốc độ đóng/mở |
| `GRIPPER_FORCE` | lực kẹp |

Với JODELL/ERG EPG 040-50, `pos` thường nằm trong khoảng `0..100`; giá trị lớn hơn nghĩa là đóng nhiều hơn. Với gripper khác, quy ước này có thể khác và cần sửa adapter trong `src/hardware/robot_VIP.py`.

Test gripper:

```bash
python tests/05_gripper_manual/manual_gripper_close_positions.py --dry-run --positions 33 38
python tests/05_gripper_manual/manual_gripper_close_positions.py --real --positions 33 38
```

### 5.8. AI engine

```python
ENGINE_TYPE = "CLOUD"      # CLOUD, LOCAL, HYBRID
CLOUD_API_URL = "https://tuongkydaisu.com/api/engine/bestmove"
CLOUD_TIMEOUT_SEC = 6
MOONFISH_EXE = "moonfish/moonfish_ucci.py"
MOONFISH_NNUE = None
MOONFISH_THINK_MS = 1000
```

Chọn mode theo môi trường:

| Mode | Khi dùng |
|---|---|
| `CLOUD` | có internet/API ổn định |
| `LOCAL` | cần chạy offline |
| `HYBRID` | ưu tiên Cloud, fallback Local |

### 5.9. Simulation API

```python
SIMULATION_API_URL = "https://tuongkydaisu.com"
SIMULATION_TOKEN = "..."
```

Token phải thay theo account/server thật. Không commit token thật nếu repo public.

---

## 6. Setup robot/bàn cờ mới

### 6.1. Dạy teaching points bắt buộc

Lưu 4 điểm trên robot controller:

| Tên | Ô bàn | Ý nghĩa |
|---|---:|---|
| `R1` | `(0,0)` | Góc đen trái, gốc bàn |
| `R2` | `(8,0)` | Góc đen phải |
| `R3` | `(8,9)` | Góc đỏ phải |
| `R4` | `(0,9)` | Góc đỏ trái |

Nguyên tắc:

```text
- TCP đặt tại tâm ô.
- Z tương ứng độ cao tham chiếu khi gắp/đặt.
- Hướng TCP nên nhất quán giữa 4 điểm.
- Runtime vẫn ép hướng theo config.ROTATION khi gắp/đặt trên bàn.
```

Sau khi connect, log cần có:

```text
Loaded R1 ...
Loaded R2 ...
Loaded R3 ...
Loaded R4 ...
COL spacing = ... mm/cột
ROW spacing = ... mm/hàng
Sử dụng Bilinear Interpolation cho tất cả vị trí
```

Check spacing/sign:

```bash
python tests/03_robot_math/test_cell_size_from_teaching_points.py
```

### 6.2. Dạy điểm khuyến nghị

| Tên | Vai trò |
|---|---|
| `HOMECHESS` | Điểm chờ sau mỗi nước, tránh che camera |
| `R_Trash` | Bãi thả quân bị ăn |

Nếu thiếu `R_Trash`, code fallback sang `CAPTURE_BIN_X/Y/Z` trong `config.py`.

### 6.3. Manual motion test

Chỉ chạy `--real` khi đã kiểm tra vùng làm việc, `SAFE_Z`, hướng TCP và không có vật cản.

```bash
python tests/04_robot_motion_manual/manual_move_center_safe.py --dry-run
python tests/04_robot_motion_manual/manual_move_center_safe.py --real --speed 20

python tests/04_robot_motion_manual/manual_move_board_positions.py --cells 0,0 4,4.5 8,9 --dry-run
python tests/04_robot_motion_manual/manual_move_board_positions.py --cells 4,4.5 --real --speed 20

python tests/04_robot_motion_manual/manual_4_rooks.py --dry-run
python tests/04_robot_motion_manual/manual_4_rooks.py --real --speed 20
```

---

## 7. Data, label và train YOLO

YOLO hiện dùng occupancy model: chỉ cần detect có quân cờ hay không. Loại quân/màu quân lấy từ board memory/FEN.

### 7.1. Thu video/ảnh

Dùng camera UI:

```bash
python tests/00_camera/droidcam_ui.py
```

Output:

```text
assets/droidcam_outputs/
```

Copy video dùng để tạo dataset vào:

```text
assets/videos/
```

### 7.2. Auto-label từ video

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

Lệnh hữu ích:

```bash
python tests/01_yolo_dataset_tools/autolabel_yolo.py --review-existing
python tests/01_yolo_dataset_tools/autolabel_yolo.py --force
python tests/01_yolo_dataset_tools/autolabel_yolo.py --auto-save
python tests/01_yolo_dataset_tools/autolabel_yolo.py --sample-seconds 1.0
```

Trong UI autolabel:

```text
s = save + next
a = previous
d = next
r = auto-detect lại
c = clear boxes
q / esc = quit
left drag = thêm bbox
right click = xóa bbox
corner drag = chỉnh bbox
```

### 7.3. Dataset stats

```bash
python tests/01_yolo_dataset_tools/dataset_stats.py
python tests/01_yolo_dataset_tools/dataset_stats.py --dataset-dir assets/custom_dataset
```

### 7.4. Train YOLO

Ví dụ Ultralytics:

```bash
yolo detect train \
  model=yolo11m.pt \
  data=assets/custom_dataset/data.yaml \
  epochs=80 \
  imgsz=640 \
  batch=8 \
  name=xiangqi_occupancy
```

Sau train:

```bash
mkdir -p assets/models
cp runs/detect/xiangqi_occupancy/weights/best.pt assets/models/best.pt
```

### 7.5. Debug YOLO pipeline T1/T2

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

## 8. Chạy hệ thống

### 8.1. Dry run

```python
DRY_RUN = True
```

```bash
python main.py
```

Trong dry run:

```text
- Không connect robot.
- Không cần camera thật.
- Di chuyển quân đỏ bằng chuột trên Pygame UI.
- AI vẫn chạy theo config engine.
```

### 8.2. Real run

```python
DRY_RUN = False
```

Checklist:

```text
- assets/models/best.pt tồn tại.
- VIDEO_SOURCE mở được bằng test_video_source.py.
- assets/perspective.npy đúng với camera hiện tại hoặc sẵn sàng calibrate lại.
- Robot ping được.
- R1/R2/R3/R4 đã dạy đúng theo bàn hiện tại.
- HOMECHESS và R_Trash đã dạy nếu dùng robot thật.
- Gripper đã config và test close/open OK.
- SAFE_Z/PICK_Z/PLACE_Z đã tune an toàn.
```

Chạy:

```bash
python main.py
```

---

## 9. Luồng chơi thực tế

### 9.1. T1 và T2

```text
T1 baseline:
    trạng thái bàn trước khi người đi.
    gồm _baseline_occ, _baseline_frame, _baseline_time.

T2:
    ảnh mới lấy sau khi bấm SPACE.
```

Luồng người chơi:

```text
1. Người chơi di chuyển quân đỏ trên bàn thật.
2. Bấm SPACE.
3. Camera lấy T2 mới.
4. SnapshotDetector so sánh T1 với T2.
5. Nếu detect hợp lệ: update board/FEN, chuyển sang lượt AI.
6. Nếu detect fail: giữ T1, bỏ che khuất/chỉnh quân rồi bấm SPACE lại.
```

Không clear baseline khi YOLO fail. Lỗi fail thường do T2 bị che/mờ/miss, không phải do T1 sai.

### 9.2. Luồng AI/robot

```text
1. AI nhận FEN hiện tại.
2. AI trả best move cho quân đen.
3. Lưu rollback checkpoint trước khi robot đi.
4. Robot gắp/đặt quân.
5. Nếu robot thành công: update board/FEN.
6. Chụp T1 mới cho lượt người tiếp theo.
```

### 9.3. Rollback / Undo

Rollback khôi phục:

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

Nút/phím:

```text
Z          = rollback khi đang lượt người
UNDO STEP  = rollback bằng UI
```

Rollback không tự sửa bàn thật. Quân vật lý phải được đặt về đúng trạng thái checkpoint trước khi bấm SPACE lại.

---

## 10. Phím/nút điều khiển

| Input | Tác dụng |
|---|---|
| `SPACE` | Chụp T2 và detect nước đi người chơi |
| `Z` | Rollback checkpoint gần nhất khi đang lượt người |
| `UNDO STEP` | Rollback bằng UI |
| `New Game` | Reset ván mới |
| `Surrender` | Đầu hàng |
| `Q` trong camera window | Thoát camera/main loop |
| Mouse drag/click | Manual move trong dry run hoặc manual override |

---

## 11. Test scripts hiện tại

| Nhóm | File | Mục đích |
|---|---|---|
| Camera | `tests/00_camera/test_video_source.py` | Test `config.VIDEO_SOURCE` |
| Camera | `tests/00_camera/droidcam_ui.py` | Preview/capture DroidCam/IP camera |
| Dataset | `tests/01_yolo_dataset_tools/autolabel_yolo.py` | Tạo/review dataset YOLO từ video |
| Dataset | `tests/01_yolo_dataset_tools/dataset_stats.py` | Thống kê dataset YOLO |
| YOLO debug | `tests/02_yolo_pipeline_debug/yolo_pipeline_debug.py` | Debug YOLO + T1/T2 snapshot |
| Robot math | `tests/03_robot_math/test_cell_size_from_teaching_points.py` | Check R1-R4 spacing/sign |
| Robot manual | `tests/04_robot_motion_manual/manual_move_center_safe.py` | MoveCart tới tâm bàn SAFE_Z |
| Robot manual | `tests/04_robot_motion_manual/manual_move_board_positions.py` | MoveCart tới các ô chỉ định |
| Robot manual | `tests/04_robot_motion_manual/manual_4_rooks.py` | Check các góc xa |
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

## 12. Ghi chú ngắn cho file quan trọng

### `main.py`

- Vòng lặp chính của game.
- Tạo T1 baseline đầu tiên sau khi init hardware.
- Chạy AI trong thread để UI không bị khóa.
- Lưu rollback checkpoint trước nước AI/robot.
- Sau robot move thành công, cập nhật board/FEN và chụp T1 mới.

### `config.py`

- Nguồn cấu hình runtime chính.
- Các giá trị cần thay theo setup: camera URL, robot IP, Z height, offset, gripper positions, token API.
- `OFFSET_X/Y` dùng theo robot/work object, không phải pixel camera.
- `CELL_SIZE_COL_MM/ROW_MM` và sign chỉ là scalar fallback.

### `src/hardware/robot_VIP.py`

- Điều khiển FR5 qua Fairino SDK.
- Gripper mặc định dùng SDK `MoveGripper`, không dùng ToolDO.
- Board pose chính dùng bilinear interpolation từ R1/R2/R3/R4.
- Direct corner teaching points vẫn ép `config.ROTATION` để giữ hướng TCP thống nhất.
- Nếu dùng robot hoặc gripper khác, file này là nơi cần viết lại adapter.

### `src/hardware/hardware_manager.py`

- Khởi tạo AI, robot, camera, YOLO model và `SnapshotDetector`.
- `capture_baseline_if_needed()` tạo T1.
- `restore_yolo_baseline()` dùng cho rollback.

### `src/ui/input_handler.py`

- `SPACE`: lấy T2, save rollback checkpoint, detect/validate move.
- YOLO fail không được clear T1 baseline.
- Retry bằng SPACE dùng T1 cũ và T2 mới.
- Manual override thành công sẽ cập nhật board và chụp lại T1.

### `src/core/game_state.py`

- Quản lý board, FEN, turn, captured pieces, UI status, rollback.
- Rollback lưu cả baseline frame để phục vụ capture ambiguity trong `SnapshotDetector`.

### `src/vision/snapshot_detector.py`

- Build occupancy từ YOLO detections.
- So sánh T1/T2 để tìm disappeared/appeared cells.
- Dùng board memory để biết quân gì đang ở ô nguồn.
- Có xử lý capture ambiguity bằng pixel absdiff khi occupancy không đổi rõ ràng.

### `src/vision/video_source.py`

- Hàm mở camera/video tập trung.
- Tránh hard-code camera ở nhiều file.

---

## 13. Troubleshooting

### Camera không mở được

```bash
python tests/00_camera/test_video_source.py --show
```

Check:

```text
- VIDEO_SOURCE đúng URL/index.
- Camera/điện thoại cùng mạng nếu dùng IP stream.
- App DroidCam/IP webcam đang bật stream.
- Firewall không chặn.
```

### YOLO không xác định được nước đi

```text
- Kiểm tra perspective.npy.
- Kiểm tra camera có bị che/mờ không.
- Kiểm tra quân đặt đúng tâm ô.
- Bấm SPACE lại sau khi bỏ che khuất.
- Không cần New Game nếu chỉ lỗi T2 tạm thời.
```

Debug:

```bash
python tests/02_yolo_pipeline_debug/yolo_pipeline_debug.py --start ... --t1 ... --t2 ...
```

### Robot không connect được

```bash
ping -c 3 <ROBOT_IP>
nc -vz <ROBOT_IP> 20003
ip route get <ROBOT_IP>
```

Nếu route đi vào Docker bridge, đổi Docker subnet hoặc xóa network xung đột.

### Gripper lỗi `73` hoặc `14`

```text
- Robot chưa ở command mode.
- Web UI/manual-auto state chưa đúng.
- Gripper chưa active hoặc controller chưa nhận command.
- GRIPPER_ID/TYPE/BLOCK chưa khớp cấu hình trên robot controller.
```

### Robot gắp lệch

```text
- Lệch đều theo cột/trái-phải: tune OFFSET_X.
- Lệch đều theo hàng/trước-sau: tune OFFSET_Y.
- Lệch không đều toàn bàn: dạy lại R1/R2/R3/R4.
- Lệch theo camera/ô detect sai: calibrate lại perspective.npy.
- Lệch theo đầu ngón: kiểm tra TCP/tool frame và hình học gripper.
```

### Robot quệt quân bên cạnh

```text
- Tăng SAFE_Z nếu quệt khi di chuyển ngang.
- Tune GRIPPER_PICK_OPEN_POS nếu ngón mở quá rộng khi hạ xuống.
- Tune ROTATION để hướng gripper phù hợp với bàn thật.
- Với gripper rộng, nên dùng hướng gắp chéo hoặc TCP phù hợp tâm kẹp.
```

---

## 14. Checklist setup cho robot/bàn mới

```text
1. Tạo Python env và cài dependencies.
2. Set VIDEO_SOURCE theo camera thật.
3. Test camera bằng tests/00_camera/test_video_source.py.
4. Calibrate camera để tạo assets/perspective.npy.
5. Thu video/ảnh với camera thật.
6. Auto-label/review dataset.
7. Train YOLO và copy best.pt vào assets/models/best.pt.
8. Set ROBOT_IP theo controller.
9. Dạy R1/R2/R3/R4 trên robot controller.
10. Dạy HOMECHESS và R_Trash nếu dùng robot thật.
11. Test robot math bằng tests/03_robot_math/test_cell_size_from_teaching_points.py.
12. Tune SAFE_Z, PICK_Z, PLACE_Z, ROTATION.
13. Tune OFFSET_X/Y.
14. Tune gripper open/pick/close/release positions.
15. Set ENGINE_TYPE và token API nếu dùng cloud/simulation.
16. Chạy python main.py.
```

---

## 15. Git và bảo mật

Không commit nếu repo public:

```text
- Token thật trong config.py
- Video dataset lớn
- runs/ training output lớn
- Cache __pycache__
- Engine binary nặng
```

Nên giữ:

```text
- Source code src/
- README.md
- tests/ đã dọn sạch
- config mẫu hoặc config đã scrub token
- data.yaml mẫu nếu cần
```
