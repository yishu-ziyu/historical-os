extends Node2D

const DATA_PATH := "res://data/branches.json"
const COLOR_BG := Color("#10120f")
const COLOR_ROAD := Color("#25241f")
const COLOR_TEXT := Color("#eadfc9")
const COLOR_MUTED := Color("#a99c84")
const COLOR_PANEL := Color(0.09, 0.085, 0.07, 0.92)
const COLOR_BORDER := Color("#3f3a2e")
const COLOR_AMBER := Color("#d9a441")

var data: Dictionary = {}
var branches: Array = []
var player: CharacterBody2D
var active_branch: Dictionary = {}
var hint_label: Label
var title_label: Label
var body_label: Label
var stability_value: Label
var risk_value: Label
var next_value: Label
var move_speed := 260.0

func _ready() -> void:
	_load_data()
	_build_world()
	_build_player()
	_build_triggers()
	_build_ui()

func _physics_process(_delta: float) -> void:
	var input := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	player.velocity = input * move_speed
	player.move_and_slide()
	_update_player_visual(input)

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("interact") and not active_branch.is_empty():
		_apply_branch(active_branch)

func _load_data() -> void:
	var file := FileAccess.open(DATA_PATH, FileAccess.READ)
	if file == null:
		push_error("Cannot open branch data: " + DATA_PATH)
		return
	var parsed = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("Branch JSON is invalid.")
		return
	data = parsed
	branches = data.get("branches", [])

func _build_world() -> void:
	var background := ColorRect.new()
	background.color = COLOR_BG
	background.size = Vector2(1280, 720)
	add_child(background)

	var grid := Node2D.new()
	grid.draw.connect(func():
		for x in range(0, 1280, 48):
			for y in range(0, 720, 48):
				var color := Color("#171a15") if ((x / 48 + y / 48) % 2 == 0) else Color("#131611")
				grid.draw_rect(Rect2(Vector2(x, y), Vector2(48, 48)), color, true)
		grid.draw_rect(Rect2(0, 320, 1280, 80), COLOR_ROAD, true)
		grid.draw_rect(Rect2(610, 0, 88, 720), COLOR_ROAD, true)
		grid.draw_rect(Rect2(0, 0, 1280, 62), Color("#18232a"), true)
		for i in range(20, 1280, 80):
			grid.draw_line(Vector2(i, 36), Vector2(i + 38, 36), Color(0.6, 0.72, 0.78, 0.24), 3.0)
		for i in range(30, 1280, 90):
			grid.draw_line(Vector2(i, 360), Vector2(i + 42, 360), Color(0.75, 0.68, 0.52, 0.22), 4.0)
	)
	add_child(grid)

	_add_building(Vector2(150, 125), Vector2(300, 185), "港口客运站", Color("#26362f"))
	_add_building(Vector2(535, 115), Vector2(275, 190), "科学院", Color("#403625"))
	_add_building(Vector2(890, 150), Vector2(310, 210), "档案室", Color("#3b2524"))
	_add_building(Vector2(745, 480), Vector2(320, 165), "报社", Color("#283440"))
	_add_lamps()

func _add_building(pos: Vector2, size: Vector2, label: String, color: Color) -> void:
	var node := Node2D.new()
	node.position = pos
	node.draw.connect(func():
		node.draw_rect(Rect2(Vector2.ZERO, size), color, true)
		node.draw_rect(Rect2(Vector2(16, 16), size - Vector2(32, 32)), Color(0, 0, 0, 0.20), true)
		for x in range(36, int(size.x - 30), 58):
			node.draw_rect(Rect2(x, 48, 24, 24), Color(0.8, 0.72, 0.55, 0.28), true)
			node.draw_rect(Rect2(x, 104, 24, 24), Color(0.8, 0.72, 0.55, 0.28), true)
	)
	add_child(node)

	var name_label := Label.new()
	name_label.text = label
	name_label.position = pos + Vector2(22, size.y - 42)
	name_label.add_theme_color_override("font_color", COLOR_TEXT)
	name_label.add_theme_font_size_override("font_size", 20)
	_apply_label_font(name_label)
	add_child(name_label)

func _add_lamps() -> void:
	for pos in [Vector2(500, 342), Vector2(690, 342), Vector2(500, 455), Vector2(690, 455)]:
		var lamp := Node2D.new()
		lamp.position = pos
		lamp.draw.connect(func():
			lamp.draw_circle(Vector2.ZERO, 46, Color(0.85, 0.62, 0.22, 0.12))
			lamp.draw_rect(Rect2(-3, -18, 6, 45), Color("#6a5630"), true)
		)
		add_child(lamp)

func _build_player() -> void:
	player = CharacterBody2D.new()
	player.name = "EinsteinPlayer"
	player.position = Vector2(650, 420)
	add_child(player)

	var collision := CollisionShape2D.new()
	var shape := RectangleShape2D.new()
	shape.size = Vector2(24, 34)
	collision.shape = shape
	collision.position = Vector2(0, 12)
	player.add_child(collision)

	var visual := Node2D.new()
	visual.name = "Visual"
	visual.draw.connect(func():
		_draw_player_visual(visual)
	)
	player.add_child(visual)

func _update_player_visual(input: Vector2) -> void:
	var visual := player.get_node("Visual") as Node2D
	if input.length() > 0.0:
		visual.rotation = sin(Time.get_ticks_msec() / 90.0) * 0.025
	else:
		visual.rotation = 0.0
	visual.queue_redraw()

func _draw_player_visual(node: Node2D) -> void:
	node.draw_rect(Rect2(-17, 29, 34, 7), Color(0, 0, 0, 0.28), true)
	node.draw_rect(Rect2(-9, 5, 18, 27), Color("#202420"), true)
	node.draw_rect(Rect2(-12, 11, 24, 17), Color("#34382f"), true)
	node.draw_rect(Rect2(-8, 31, 5, 9), Color("#171817"), true)
	node.draw_rect(Rect2(3, 31, 5, 9), Color("#171817"), true)
	node.draw_rect(Rect2(-8, -10, 16, 16), Color("#cdbf9e"), true)
	node.draw_rect(Rect2(-15, -14, 8, 10), Color("#e6dfcf"), true)
	node.draw_rect(Rect2(7, -14, 8, 10), Color("#e6dfcf"), true)
	node.draw_rect(Rect2(-6, -18, 12, 6), Color("#e6dfcf"), true)
	node.draw_rect(Rect2(-10, 4, 20, 3), Color("#5c5548"), true)
	node.draw_rect(Rect2(-5, -3, 3, 2), Color("#1d1b18"), true)
	node.draw_rect(Rect2(4, -3, 3, 2), Color("#1d1b18"), true)
	node.draw_rect(Rect2(-4, 8, 10, 2), Color("#1d1b18"), true)

func _build_triggers() -> void:
	for branch in branches:
		var pos := _array_to_vector2(branch.get("position", [0, 0]))
		var size := _array_to_vector2(branch.get("size", [120, 90]))
		var area := Area2D.new()
		area.name = branch.get("id", "BranchTrigger")
		area.position = pos
		add_child(area)

		var shape_node := CollisionShape2D.new()
		var shape := RectangleShape2D.new()
		shape.size = size
		shape_node.shape = shape
		shape_node.position = size * 0.5
		area.add_child(shape_node)

		var visual := Node2D.new()
		visual.draw.connect(func():
			var color := Color(branch.get("color", "#d9a441"))
			visual.draw_rect(Rect2(Vector2.ZERO, size), Color(color.r, color.g, color.b, 0.08), true)
			visual.draw_rect(Rect2(Vector2.ZERO, size), color, false, 3.0)
			visual.draw_rect(Rect2(size * 0.5 - Vector2(36, 22), Vector2(72, 44)), Color(0.06, 0.05, 0.04, 0.82), true)
			visual.draw_rect(Rect2(size * 0.5 - Vector2(36, 22), Vector2(72, 44)), color, false, 2.0)
		)
		area.add_child(visual)

		var label := Label.new()
		label.text = branch.get("label", "")
		label.position = pos + Vector2(12, -30)
		label.add_theme_color_override("font_color", COLOR_TEXT)
		label.add_theme_font_size_override("font_size", 17)
		_apply_label_font(label)
		add_child(label)

		var marker := Label.new()
		marker.text = _marker_text(branch.get("id", ""))
		marker.position = pos + size * 0.5 - Vector2(24, 12)
		marker.add_theme_color_override("font_color", COLOR_TEXT)
		marker.add_theme_font_size_override("font_size", 14)
		_apply_label_font(marker)
		add_child(marker)

		area.body_entered.connect(func(body: Node):
			if body == player:
				active_branch = branch
				hint_label.text = branch.get("label", "") + "：" + branch.get("prompt", "")
		)
		area.body_exited.connect(func(body: Node):
			if body == player and active_branch.get("id", "") == branch.get("id", ""):
				active_branch = {}
				hint_label.text = "移动到地点热区，按空格读取历史分叉。"
		)

func _build_ui() -> void:
	var canvas_layer := CanvasLayer.new()
	add_child(canvas_layer)

	var title := Label.new()
	title.text = data.get("case_title", "Walking Historical Branch")
	title.position = Vector2(32, 22)
	title.add_theme_color_override("font_color", COLOR_TEXT)
	title.add_theme_font_size_override("font_size", 28)
	_apply_label_font(title)
	canvas_layer.add_child(title)

	var panel := PanelContainer.new()
	panel.position = Vector2(940, 36)
	panel.size = Vector2(304, 640)
	panel.add_theme_stylebox_override("panel", _style(COLOR_PANEL, COLOR_BORDER, 2, 1))
	canvas_layer.add_child(panel)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 18)
	margin.add_theme_constant_override("margin_right", 18)
	margin.add_theme_constant_override("margin_top", 18)
	margin.add_theme_constant_override("margin_bottom", 18)
	panel.add_child(margin)

	var stack := VBoxContainer.new()
	stack.add_theme_constant_override("separation", 18)
	margin.add_child(stack)

	var eyebrow := Label.new()
	eyebrow.text = "CURRENT DOSSIER"
	eyebrow.add_theme_color_override("font_color", COLOR_MUTED)
	eyebrow.add_theme_font_size_override("font_size", 12)
	_apply_label_font(eyebrow)
	stack.add_child(eyebrow)

	title_label = Label.new()
	title_label.text = "爱因斯坦仍在柏林"
	title_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	title_label.add_theme_color_override("font_color", COLOR_TEXT)
	title_label.add_theme_font_size_override("font_size", 26)
	_apply_label_font(title_label)
	stack.add_child(title_label)

	body_label = Label.new()
	body_label.text = data.get("baseline", "")
	body_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body_label.add_theme_color_override("font_color", COLOR_TEXT)
	body_label.add_theme_font_size_override("font_size", 16)
	_apply_label_font(body_label)
	stack.add_child(body_label)

	stability_value = _add_fact(stack, "世界线稳定度", "72%")
	risk_value = _add_fact(stack, "公开风险", "中")
	next_value = _add_fact(stack, "下一步形态", "档案卡 / 报纸 / 地图反馈")

	hint_label = Label.new()
	hint_label.text = "移动到地点热区，按空格读取历史分叉。"
	hint_label.position = Vector2(34, 640)
	hint_label.size = Vector2(860, 42)
	hint_label.add_theme_color_override("font_color", COLOR_TEXT)
	hint_label.add_theme_font_size_override("font_size", 18)
	_apply_label_font(hint_label)
	canvas_layer.add_child(hint_label)

func _add_fact(stack: VBoxContainer, label_text: String, value_text: String) -> Label:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	stack.add_child(row)

	var label := Label.new()
	label.text = label_text
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.add_theme_color_override("font_color", COLOR_MUTED)
	label.add_theme_font_size_override("font_size", 15)
	_apply_label_font(label)
	row.add_child(label)

	var value := Label.new()
	value.text = value_text
	value.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	value.custom_minimum_size = Vector2(138, 0)
	value.add_theme_color_override("font_color", COLOR_TEXT)
	value.add_theme_font_size_override("font_size", 15)
	_apply_label_font(value)
	row.add_child(value)
	return value

func _apply_branch(branch: Dictionary) -> void:
	title_label.text = branch.get("title", "")
	body_label.text = branch.get("result", "")
	stability_value.text = branch.get("stability", "--")
	risk_value.text = branch.get("risk", "--")
	next_value.text = branch.get("next", "")

func _array_to_vector2(value: Variant) -> Vector2:
	if typeof(value) == TYPE_ARRAY and value.size() >= 2:
		return Vector2(float(value[0]), float(value[1]))
	return Vector2.ZERO

func _marker_text(id: String) -> String:
	if id == "port_exit":
		return "PASS"
	if id == "academy_stay":
		return "DOC"
	if id == "police_risk":
		return "RISK"
	if id == "press_public":
		return "NEWS"
	return "INFO"

func _apply_label_font(label: Label) -> void:
	label.add_theme_constant_override("outline_size", 0)

func _style(color: Color, border: Color, radius: int, width: int) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = color
	box.border_color = border
	box.set_border_width_all(width)
	box.set_corner_radius_all(radius)
	return box
