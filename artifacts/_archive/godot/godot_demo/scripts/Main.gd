extends Control

const DATA_PATH := "res://data/workbench.json"
const UI_FONT_PATH := "res://assets/fonts/HiraginoSansGB.ttc"

const COLOR_BG := Color("#101214")
const COLOR_PANEL := Color("#181b1f")
const COLOR_PANEL_DARK := Color("#111418")
const COLOR_BORDER := Color("#2c333a")
const COLOR_TEXT := Color("#e8e0cf")
const COLOR_MUTED := Color("#9c9588")
const COLOR_AMBER := Color("#d6a94f")
const COLOR_GREEN := Color("#78a878")
const COLOR_RED := Color("#b85c5c")
const COLOR_BLUE := Color("#6f91b8")

var data: Dictionary
var window_layer: Control
var notification_label: Label
var focus_label: Label
var language := "zh"
var z_counter := 10
var windows := {}

func _ready() -> void:
	_load_data()
	_apply_theme()
	_build_ui()

func _load_data() -> void:
	var file := FileAccess.open(DATA_PATH, FileAccess.READ)
	if file == null:
		push_error("Cannot open workbench data.")
		data = {}
		return
	var parsed = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("Workbench JSON is invalid.")
		data = {}
		return
	data = parsed
	language = data.get("default_language", "zh")

func _active_data() -> Dictionary:
	var languages: Dictionary = data.get("languages", {})
	return languages.get(language, {})

func _apply_theme() -> void:
	var theme := Theme.new()
	var font: Font = load(UI_FONT_PATH)
	theme.default_font = font
	theme.default_font_size = 16
	theme.set_color("font_color", "Label", COLOR_TEXT)
	theme.set_color("font_color", "Button", COLOR_TEXT)
	theme.set_color("font_hover_color", "Button", COLOR_AMBER)
	theme.set_color("font_pressed_color", "Button", COLOR_GREEN)
	theme.set_color("font_disabled_color", "Button", COLOR_MUTED)

	var button_normal := StyleBoxFlat.new()
	button_normal.bg_color = Color(0.09, 0.105, 0.12, 0.92)
	button_normal.border_color = Color(0.22, 0.26, 0.30, 0.95)
	button_normal.set_border_width_all(1)
	button_normal.set_corner_radius_all(3)
	button_normal.content_margin_left = 12
	button_normal.content_margin_right = 12
	button_normal.content_margin_top = 8
	button_normal.content_margin_bottom = 8
	theme.set_stylebox("normal", "Button", button_normal)

	var button_hover := button_normal.duplicate()
	button_hover.bg_color = Color(0.16, 0.13, 0.075, 0.98)
	button_hover.border_color = COLOR_AMBER
	theme.set_stylebox("hover", "Button", button_hover)

	var button_pressed := button_normal.duplicate()
	button_pressed.bg_color = Color(0.09, 0.16, 0.10, 0.98)
	button_pressed.border_color = COLOR_GREEN
	theme.set_stylebox("pressed", "Button", button_pressed)
	set_theme(theme)

func _build_ui() -> void:
	var background := ColorRect.new()
	background.color = COLOR_BG
	background.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(background)

	_add_grid_background()
	_add_top_bar()
	_add_alert_banner()

	window_layer = Control.new()
	window_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	window_layer.offset_top = 88
	add_child(window_layer)

	_add_default_windows()
	_add_notification_area()

func _add_grid_background() -> void:
	var grid := Control.new()
	grid.set_anchors_preset(Control.PRESET_FULL_RECT)
	grid.draw.connect(func():
		var size := grid.size
		for x in range(0, int(size.x), 40):
			grid.draw_line(Vector2(x, 0), Vector2(x, size.y), Color(0.18, 0.22, 0.25, 0.12), 1.0)
		for y in range(0, int(size.y), 40):
			grid.draw_line(Vector2(0, y), Vector2(size.x, y), Color(0.18, 0.22, 0.25, 0.12), 1.0)
	)
	add_child(grid)

func _add_top_bar() -> void:
	var top := PanelContainer.new()
	top.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top.custom_minimum_size = Vector2(0, 40)
	top.add_theme_stylebox_override("panel", _style(Color("#0d0f11"), COLOR_BORDER, 0, 0))
	add_child(top)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 18)
	margin.add_theme_constant_override("margin_right", 18)
	top.add_child(margin)

	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 18)
	margin.add_child(row)

	var top_data: Dictionary = data.get("top_bar", {})
	var screen: Dictionary = _active_data()
	top_data = screen.get("top_bar", {})
	var labels: Dictionary = screen.get("labels", {})
	_add_top_label(row, top_data.get("product", "Historical OS"), COLOR_TEXT, 18)
	_add_top_label(row, top_data.get("subtitle", ""), COLOR_MUTED, 13)
	_add_status_dot(row, COLOR_GREEN)
	_add_top_label(row, top_data.get("case_label", "Case") + ": " + top_data.get("case", "UNKNOWN"), COLOR_MUTED, 15)
	_add_top_label(row, top_data.get("system_date_label", "System Date") + ": " + top_data.get("system_date", "--"), COLOR_MUTED, 15)
	_add_top_label(row, top_data.get("baseline_drift_label", "Baseline Drift") + ": " + top_data.get("baseline_drift", "LOW"), COLOR_AMBER, 15)
	_add_top_label(row, top_data.get("unread_label", "Unread") + ": " + str(int(top_data.get("unread", 0))), COLOR_RED, 15)

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(spacer)
	_add_top_label(row, top_data.get("audit_label", "Audit Channel: ACTIVE"), COLOR_BLUE, 15)

	var language_button := Button.new()
	language_button.text = labels.get("language_button", "EN")
	language_button.custom_minimum_size = Vector2(58, 28)
	language_button.pressed.connect(_toggle_language)
	row.add_child(language_button)

func _add_alert_banner() -> void:
	var screen: Dictionary = _active_data()
	var alert: Dictionary = screen.get("alert", {})
	var banner := PanelContainer.new()
	banner.set_anchors_preset(Control.PRESET_TOP_WIDE)
	banner.offset_top = 42
	banner.custom_minimum_size = Vector2(0, 44)
	banner.add_theme_stylebox_override("panel", _style(Color("#15110b"), Color("#5f3e19"), 0, 1))
	add_child(banner)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 22)
	margin.add_theme_constant_override("margin_right", 22)
	margin.add_theme_constant_override("margin_top", 8)
	margin.add_theme_constant_override("margin_bottom", 8)
	banner.add_child(margin)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	margin.add_child(row)
	_add_top_label(row, alert.get("level", "ANOMALY ALERT"), COLOR_RED, 15)
	_add_top_label(row, alert.get("title", ""), COLOR_AMBER, 16)
	var summary := Label.new()
	summary.text = alert.get("summary", "")
	summary.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	summary.add_theme_color_override("font_color", COLOR_TEXT)
	summary.add_theme_font_size_override("font_size", 14)
	row.add_child(summary)

func _toggle_language() -> void:
	language = "en" if language == "zh" else "zh"
	_rebuild_ui()

func _rebuild_ui() -> void:
	for child in get_children():
		child.queue_free()
	windows.clear()
	z_counter = 10
	focus_label = null
	notification_label = null
	_build_ui()

func _add_default_windows() -> void:
	var viewport_size := get_viewport_rect().size
	var w := viewport_size.x
	var h := viewport_size.y - 88
	var titles: Dictionary = _active_data().get("windows", {})

	windows["timeline"] = _create_window(titles.get("timeline", "Timeline"), Vector2(26, 24), Vector2(w * 0.24, h * 0.54), _timeline_content())
	windows["intel"] = _create_window(titles.get("intel", "Intel Desk"), Vector2(w * 0.27, 24), Vector2(w * 0.46, h * 0.54), _intel_content())
	windows["map"] = _create_window(titles.get("map", "Map"), Vector2(w * 0.75, 24), Vector2(w * 0.23, h * 0.54), _map_content())
	windows["archives"] = _create_window(titles.get("archives", "Archives"), Vector2(26, h * 0.62), Vector2(w * 0.56, h * 0.30), _archives_content())
	windows["risk"] = _create_window(titles.get("risk", "Risk"), Vector2(w * 0.60, h * 0.62), Vector2(w * 0.38, h * 0.30), _risk_content())

func _add_notification_area() -> void:
	var area := PanelContainer.new()
	area.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	area.offset_left = 22
	area.offset_right = -22
	area.offset_bottom = -18
	area.offset_top = -70
	area.add_theme_stylebox_override("panel", _style(Color(0.06, 0.07, 0.08, 0.94), COLOR_BORDER, 3, 1))
	add_child(area)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 16)
	margin.add_theme_constant_override("margin_right", 16)
	margin.add_theme_constant_override("margin_top", 10)
	margin.add_theme_constant_override("margin_bottom", 10)
	area.add_child(margin)

	notification_label = Label.new()
	notification_label.text = _active_data().get("notification_ready", "System ready.")
	notification_label.add_theme_color_override("font_color", COLOR_GREEN)
	notification_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	margin.add_child(notification_label)

func _create_window(title: String, pos: Vector2, size: Vector2, content: Control) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.position = pos
	panel.custom_minimum_size = size
	panel.size = size
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	panel.add_theme_stylebox_override("panel", _style(COLOR_PANEL, COLOR_BORDER, 4, 1))
	window_layer.add_child(panel)

	var stack := VBoxContainer.new()
	stack.add_theme_constant_override("separation", 0)
	panel.add_child(stack)

	var title_bar := HBoxContainer.new()
	title_bar.custom_minimum_size = Vector2(0, 34)
	title_bar.mouse_filter = Control.MOUSE_FILTER_STOP
	title_bar.add_theme_constant_override("separation", 8)
	stack.add_child(title_bar)

	var grip := Label.new()
	grip.text = "▦"
	grip.add_theme_color_override("font_color", COLOR_AMBER)
	grip.add_theme_font_size_override("font_size", 17)
	title_bar.add_child(grip)

	var title_label := Label.new()
	title_label.text = title
	title_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title_label.add_theme_color_override("font_color", COLOR_TEXT)
	title_label.add_theme_font_size_override("font_size", 16)
	title_bar.add_child(title_label)

	var unread := Label.new()
	unread.text = "●"
	unread.add_theme_color_override("font_color", COLOR_AMBER)
	title_bar.add_child(unread)

	var minimize := Button.new()
	minimize.text = "−"
	minimize.custom_minimum_size = Vector2(32, 26)
	title_bar.add_child(minimize)

	var content_margin := MarginContainer.new()
	content_margin.add_theme_constant_override("margin_left", 14)
	content_margin.add_theme_constant_override("margin_right", 14)
	content_margin.add_theme_constant_override("margin_top", 10)
	content_margin.add_theme_constant_override("margin_bottom", 12)
	content_margin.size_flags_vertical = Control.SIZE_EXPAND_FILL
	stack.add_child(content_margin)
	content_margin.add_child(content)

	var drag_state := {"dragging": false, "offset": Vector2.ZERO}
	title_bar.gui_input.connect(func(event: InputEvent):
		if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
			drag_state["dragging"] = event.pressed
			drag_state["offset"] = panel.get_global_mouse_position() - panel.global_position
			if event.pressed:
				_bring_to_front(panel)
		elif event is InputEventMouseMotion and drag_state["dragging"]:
			panel.global_position = panel.get_global_mouse_position() - drag_state["offset"]
	)
	panel.gui_input.connect(func(event: InputEvent):
		if event is InputEventMouseButton and event.pressed:
			_bring_to_front(panel)
	)
	minimize.pressed.connect(func():
		content_margin.visible = not content_margin.visible
		panel.custom_minimum_size.y = 40 if not content_margin.visible else size.y
		panel.size.y = panel.custom_minimum_size.y
		minimize.text = "+" if not content_margin.visible else "−"
		var screen: Dictionary = _active_data()
		var suffix: String = screen.get("minimized_suffix", "minimized.") if not content_margin.visible else screen.get("restored_suffix", "restored.")
		_set_feedback(title + " " + suffix)
	)
	return panel

func _intel_content() -> Control:
	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 10)
	var screen: Dictionary = _active_data()
	var labels: Dictionary = screen.get("labels", {})
	var intel: Dictionary = screen.get("intel", {})

	_add_section_label(root, intel.get("classification", "URGENT"), COLOR_AMBER, 17)
	for line in intel.get("lines", []):
		_add_body_label(root, line, COLOR_TEXT, 15)
	_add_separator(root)
	_add_body_label(root, labels.get("message", "Message") + ":\n" + intel.get("message", ""), COLOR_TEXT, 15)
	_add_separator(root)
	_add_body_label(root, labels.get("system_note", "System Note") + ":\n" + intel.get("system_note", ""), COLOR_MUTED, 14)
	_add_body_label(root, labels.get("suggestion", "Suggestion") + ":\n" + intel.get("suggestion", ""), COLOR_AMBER, 14)

	focus_label = Label.new()
	focus_label.text = labels.get("focus", "Current Focus") + ": " + labels.get("initial_focus", "Urgent dispatch unread")
	focus_label.add_theme_color_override("font_color", COLOR_BLUE)
	root.add_child(focus_label)

	var buttons := GridContainer.new()
	buttons.columns = 3
	buttons.add_theme_constant_override("h_separation", 8)
	buttons.add_theme_constant_override("v_separation", 8)
	root.add_child(buttons)
	for action in screen.get("actions", []):
		_add_action_button(buttons, action.get("label", ""), action.get("window", "intel"), action.get("feedback", "directive"))
	return root

func _timeline_content() -> Control:
	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 8)
	var screen: Dictionary = _active_data()
	var labels: Dictionary = screen.get("labels", {})
	_add_section_label(root, labels.get("timeline_heading", "Baseline mismatch detected"), COLOR_AMBER, 15)
	for item in screen.get("timeline", []):
		var item_text := String(item)
		var color := COLOR_AMBER if item_text.contains("[ANOMALY]") or item_text.contains("[异常]") else COLOR_TEXT
		_add_body_label(root, item, color, 14)
	return root

func _map_content() -> Control:
	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 8)
	var screen: Dictionary = _active_data()
	var labels: Dictionary = screen.get("labels", {})
	var map_data: Dictionary = screen.get("map", {})
	_add_section_label(root, labels.get("map_heading", "Relevant Locations"), COLOR_BLUE, 15)
	for place in map_data.get("places", []):
		_add_body_label(root, "□ " + place, COLOR_TEXT, 15)
	_add_separator(root)
	_add_body_label(root, labels.get("baseline_route", "Baseline Route") + ":\n" + map_data.get("baseline_route", ""), COLOR_MUTED, 14)
	_add_body_label(root, labels.get("current_trace", "Current Trace") + ":\n" + map_data.get("current_trace", ""), COLOR_AMBER, 14)
	return root

func _archives_content() -> Control:
	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 8)
	for record in _active_data().get("archives", []):
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		root.add_child(row)
		var name_label := Label.new()
		name_label.text = record.get("name", "")
		name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		name_label.add_theme_color_override("font_color", COLOR_TEXT)
		row.add_child(name_label)
		var status := Label.new()
		status.text = record.get("status", "")
		status.add_theme_color_override("font_color", _status_color(status.text))
		row.add_child(status)
	return root

func _risk_content() -> Control:
	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 7)
	var screen: Dictionary = _active_data()
	for item in screen.get("risk", []):
		var item_text := String(item)
		var color := COLOR_RED if item_text.contains("High") or item_text.contains("Severe") or item_text.contains("高") or item_text.contains("严重") else COLOR_TEXT
		_add_body_label(root, item, color, 14)
	_add_separator(root)
	_add_body_label(root, screen.get("historical_notice", ""), COLOR_RED, 13)
	return root

func _add_action_button(parent: Control, label: String, window_id: String, feedback_id: String) -> void:
	var button := Button.new()
	button.text = label
	button.custom_minimum_size = Vector2(0, 34)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.pressed.connect(func():
		_focus_window(window_id)
		var screen: Dictionary = _active_data()
		var feedback: Dictionary = screen.get("feedback", {})
		_set_feedback(feedback.get(feedback_id, label + " " + screen.get("selected_suffix", "selected.")))
		if focus_label:
			var labels: Dictionary = screen.get("labels", {})
			focus_label.text = labels.get("focus", "Current Focus") + ": " + label
	)
	parent.add_child(button)

func _focus_window(id: String) -> void:
	if not windows.has(id):
		return
	var panel: PanelContainer = windows[id]
	_bring_to_front(panel)
	var tween := create_tween()
	tween.tween_property(panel, "modulate", Color(1.25, 1.14, 0.86, 1.0), 0.08)
	tween.tween_property(panel, "modulate", Color.WHITE, 0.18)

func _bring_to_front(panel: Control) -> void:
	z_counter += 1
	panel.z_index = z_counter

func _set_feedback(text: String) -> void:
	notification_label.text = text
	notification_label.add_theme_color_override("font_color", COLOR_AMBER)

func _add_top_label(parent: Control, text: String, color: Color, font_size: int) -> void:
	var label := Label.new()
	label.text = text
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_size_override("font_size", font_size)
	parent.add_child(label)

func _add_status_dot(parent: Control, color: Color) -> void:
	var dot := Label.new()
	dot.text = "●"
	dot.add_theme_color_override("font_color", color)
	parent.add_child(dot)

func _add_section_label(parent: Control, text: String, color: Color, font_size: int) -> void:
	var label := Label.new()
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_size_override("font_size", font_size)
	parent.add_child(label)

func _add_body_label(parent: Control, text: String, color: Color, font_size: int) -> void:
	var label := Label.new()
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_size_override("font_size", font_size)
	parent.add_child(label)

func _add_separator(parent: Control) -> void:
	var line := ColorRect.new()
	line.color = Color(0.25, 0.30, 0.34, 0.55)
	line.custom_minimum_size = Vector2(0, 1)
	parent.add_child(line)

func _style(bg_color: Color, border_color: Color, radius: int, border_width: int) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = bg_color
	style.border_color = border_color
	style.set_border_width_all(border_width)
	style.set_corner_radius_all(radius)
	return style

func _status_color(status: String) -> Color:
	if status.contains("conflict") or status.contains("missing") or status.contains("冲突") or status.contains("缺失"):
		return COLOR_RED
	if status.contains("unverified") or status.contains("未核验"):
		return COLOR_AMBER
	return COLOR_BLUE
