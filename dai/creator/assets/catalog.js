window.DAI_CREATOR_CATALOG = {
  "actions": [
    {
      "id": "pause_menu",
      "category": "Menus & Screens",
      "params": [],
      "purpose": "Open Minecraft's pause menu."
    },
    {
      "id": "update_menu",
      "category": "Menus & Screens",
      "params": [
        "menu",
        "open"
      ],
      "purpose": "Open or update a DAI menu."
    },
    {
      "id": "open_chat",
      "category": "Menus & Screens",
      "params": [],
      "purpose": "Open the chat screen."
    },
    {
      "id": "close_screen",
      "category": "Menus & Screens",
      "params": [],
      "purpose": "Close the currently open screen."
    },
    {
      "id": "set_look",
      "category": "Camera & Look",
      "params": [
        "yaw",
        "pitch"
      ],
      "purpose": "Set player yaw and pitch."
    },
    {
      "id": "add_look",
      "category": "Camera & Look",
      "params": [
        "yaw",
        "pitch"
      ],
      "purpose": "Add yaw/pitch offsets to the current view."
    },
    {
      "id": "move",
      "category": "Movement",
      "params": [
        "direction",
        "ticks"
      ],
      "purpose": "Move in a cardinal player-relative direction for a number of ticks."
    },
    {
      "id": "jump",
      "category": "Movement",
      "params": [
        "direction",
        "ticks"
      ],
      "purpose": "Jump; optionally combine the jump with short directional movement."
    },
    {
      "id": "crouch_toggle",
      "category": "Movement",
      "params": [],
      "purpose": "Toggle crouch/sneak input."
    },
    {
      "id": "crouch_set",
      "category": "Movement",
      "params": [
        "state"
      ],
      "purpose": "Explicitly enable or disable crouch."
    },
    {
      "id": "sprint_toggle",
      "category": "Movement",
      "params": [],
      "purpose": "Toggle sprint input."
    },
    {
      "id": "sprint_set",
      "category": "Movement",
      "params": [
        "state"
      ],
      "purpose": "Explicitly enable or disable sprint."
    },
    {
      "id": "swim_toggle",
      "category": "Movement",
      "params": [],
      "purpose": "Toggle managed swimming."
    },
    {
      "id": "swim_set",
      "category": "Movement",
      "params": [
        "state"
      ],
      "purpose": "Explicitly enable or disable managed swimming."
    },
    {
      "id": "input_stop_all",
      "category": "Movement",
      "params": [],
      "purpose": "Release/reset all DAI-managed movement input."
    },
    {
      "id": "scan",
      "category": "Targeting & Recognition",
      "params": [],
      "purpose": "Run the normal target scan."
    },
    {
      "id": "target_clear",
      "category": "Targeting & Recognition",
      "params": [],
      "purpose": "Clear the current selected DAI target."
    },
    {
      "id": "recognize_target",
      "category": "Targeting & Recognition",
      "params": [],
      "purpose": "Run recognition against the selected target."
    },
    {
      "id": "recognize_block",
      "category": "Targeting & Recognition",
      "params": [
        "action",
        "value"
      ],
      "purpose": "Find a nearby block or block tag and select it as the target."
    },
    {
      "id": "attack_target",
      "category": "Combat",
      "params": [],
      "purpose": "Attack the current DAI target."
    },
    {
      "id": "attack_basic",
      "category": "Combat",
      "params": [],
      "purpose": "Perform a basic attack."
    },
    {
      "id": "attack_start",
      "category": "Combat",
      "params": [],
      "purpose": "Hold attack."
    },
    {
      "id": "attack_stop",
      "category": "Combat",
      "params": [],
      "purpose": "Release attack."
    },
    {
      "id": "automation_start_vanilla_gameplay",
      "category": "Automation / Compatibility",
      "params": [],
      "purpose": "Automation start vanilla gameplay."
    },
    {
      "id": "automation_start_speedrun",
      "category": "Automation / Compatibility",
      "params": [],
      "purpose": "Automation start speedrun."
    },
    {
      "id": "automation_start_creative_builder",
      "category": "Automation / Compatibility",
      "params": [],
      "purpose": "Automation start creative builder."
    },
    {
      "id": "automation_start_adventure",
      "category": "Automation / Compatibility",
      "params": [],
      "purpose": "Automation start adventure."
    },
    {
      "id": "automation_continue",
      "category": "Automation / Compatibility",
      "params": [],
      "purpose": "Continue the currently configured automation lifecycle."
    },
    {
      "id": "speedrun_find_portal_site",
      "category": "Automation / Compatibility",
      "params": [
        "open"
      ],
      "purpose": "Speedrun find portal site."
    },
    {
      "id": "automation_stop",
      "category": "Automation / Compatibility",
      "params": [],
      "purpose": "Stop active automation and clear managed runtime work."
    },
    {
      "id": "set_gamemode",
      "category": "Game Mode, Input & Creative",
      "params": [
        "action"
      ],
      "purpose": "Request a gamemode change through Minecraft's normal command path."
    },
    {
      "id": "run_command",
      "category": "Game Mode, Input & Creative",
      "params": [
        "action"
      ],
      "purpose": "Submit a Minecraft command string."
    },
    {
      "id": "key_click",
      "category": "Game Mode, Input & Creative",
      "params": [
        "action"
      ],
      "purpose": "Click a named key once."
    },
    {
      "id": "key_press",
      "category": "Game Mode, Input & Creative",
      "params": [
        "action"
      ],
      "purpose": "Press/hold a named key."
    },
    {
      "id": "key_release",
      "category": "Game Mode, Input & Creative",
      "params": [
        "action"
      ],
      "purpose": "Release a named key."
    },
    {
      "id": "type_text",
      "category": "Game Mode, Input & Creative",
      "params": [
        "action"
      ],
      "purpose": "Type the supplied text through DAI's input layer."
    },
    {
      "id": "creative_open_inventory",
      "category": "Game Mode, Input & Creative",
      "params": [],
      "purpose": "Open the Creative inventory."
    },
    {
      "id": "creative_close_inventory",
      "category": "Game Mode, Input & Creative",
      "params": [],
      "purpose": "Close the Creative inventory."
    },
    {
      "id": "creative_select_tab",
      "category": "Game Mode, Input & Creative",
      "params": [
        "action"
      ],
      "purpose": "Select a Creative inventory tab."
    },
    {
      "id": "creative_search_item",
      "category": "Game Mode, Input & Creative",
      "params": [
        "action"
      ],
      "purpose": "Enter a Creative inventory search query."
    },
    {
      "id": "creative_take_item",
      "category": "Game Mode, Input & Creative",
      "params": [
        "action",
        "slot"
      ],
      "purpose": "Take a visible Creative item into a hotbar slot."
    },
    {
      "id": "creative_equip_item",
      "category": "Game Mode, Input & Creative",
      "params": [
        "action",
        "slot"
      ],
      "purpose": "Put a specified Creative item directly into a hotbar slot."
    },
    {
      "id": "creative_save_toolbar",
      "category": "Game Mode, Input & Creative",
      "params": [],
      "purpose": "Save a Creative toolbar preset."
    },
    {
      "id": "creative_load_toolbar",
      "category": "Game Mode, Input & Creative",
      "params": [],
      "purpose": "Load a Creative toolbar preset."
    },
    {
      "id": "creative_pick_block_nbt",
      "category": "Game Mode, Input & Creative",
      "params": [],
      "purpose": "Creative pick-block while preserving block data."
    },
    {
      "id": "creative_remove_block",
      "category": "Game Mode, Input & Creative",
      "params": [],
      "purpose": "Remove the selected block through the Creative helper."
    },
    {
      "id": "creative_place_block",
      "category": "Game Mode, Input & Creative",
      "params": [],
      "purpose": "Place the currently selected Creative block."
    },
    {
      "id": "creative_set_block",
      "category": "Game Mode, Input & Creative",
      "params": [
        "action"
      ],
      "purpose": "Apply a requested block-state string through the Creative helper."
    },
    {
      "id": "creative_flight_set",
      "category": "Game Mode, Input & Creative",
      "params": [
        "state"
      ],
      "purpose": "Enable or disable Creative flight."
    },
    {
      "id": "creative_fly_to",
      "category": "Game Mode, Input & Creative",
      "params": [
        "ticks",
        "value"
      ],
      "purpose": "Fly toward the current spatial destination."
    },
    {
      "id": "wait_for_creative_flight",
      "category": "Game Mode, Input & Creative",
      "params": [
        "slot"
      ],
      "purpose": "Wait for the active Creative flight generation to finish."
    },
    {
      "id": "creative_hover",
      "category": "Game Mode, Input & Creative",
      "params": [
        "ticks"
      ],
      "purpose": "Hold position in Creative flight for a number of ticks."
    },
    {
      "id": "creative_build_blueprint",
      "category": "Game Mode, Input & Creative",
      "params": [],
      "purpose": "Start the configured Creative blueprint build."
    },
    {
      "id": "creative_blueprint_cell",
      "category": "Game Mode, Input & Creative",
      "params": [],
      "purpose": "Nested blueprint payload type; normally not dispatched directly."
    },
    {
      "id": "wait_for_creative_build",
      "category": "Game Mode, Input & Creative",
      "params": [
        "slot"
      ],
      "purpose": "Wait for the active Creative build generation to finish."
    },
    {
      "id": "open_inventory",
      "category": "Inventory & Hotbar",
      "params": [],
      "purpose": "Open the player's inventory."
    },
    {
      "id": "hotbar_select",
      "category": "Inventory & Hotbar",
      "params": [
        "slot"
      ],
      "purpose": "Select a hotbar slot."
    },
    {
      "id": "hotbar_next",
      "category": "Inventory & Hotbar",
      "params": [],
      "purpose": "Select the next hotbar slot."
    },
    {
      "id": "hotbar_previous",
      "category": "Inventory & Hotbar",
      "params": [],
      "purpose": "Select the previous hotbar slot."
    },
    {
      "id": "hotbar_normalize",
      "category": "Inventory & Hotbar",
      "params": [],
      "purpose": "Normalize/reorganize the hotbar using DAI's helper."
    },
    {
      "id": "item_use",
      "category": "Inventory & Hotbar",
      "params": [],
      "purpose": "Perform a normal item-use click."
    },
    {
      "id": "use_start",
      "category": "Inventory & Hotbar",
      "params": [],
      "purpose": "Hold item use."
    },
    {
      "id": "use_stop",
      "category": "Inventory & Hotbar",
      "params": [],
      "purpose": "Release item use."
    },
    {
      "id": "item_drop",
      "category": "Inventory & Hotbar",
      "params": [],
      "purpose": "Drop the currently selected item."
    },
    {
      "id": "item_swap",
      "category": "Inventory & Hotbar",
      "params": [],
      "purpose": "Swap main-hand and off-hand items."
    },
    {
      "id": "hotbar_select_item",
      "category": "Equipment Selection",
      "params": [
        "action"
      ],
      "purpose": "Select a matching item in the hotbar."
    },
    {
      "id": "equip_best_tool",
      "category": "Equipment Selection",
      "params": [
        "action"
      ],
      "purpose": "Equip the best tool, optionally for a requested target."
    },
    {
      "id": "equip_best_weapon",
      "category": "Equipment Selection",
      "params": [],
      "purpose": "Equip the best available weapon."
    },
    {
      "id": "equip_best_food",
      "category": "Equipment Selection",
      "params": [],
      "purpose": "Equip the best available food."
    },
    {
      "id": "equip_best_block",
      "category": "Equipment Selection",
      "params": [
        "action"
      ],
      "purpose": "Equip the best matching block."
    },
    {
      "id": "interact",
      "category": "Interaction",
      "params": [],
      "purpose": "Perform a normal interaction with the current crosshair target."
    },
    {
      "id": "pick_block",
      "category": "Interaction",
      "params": [],
      "purpose": "Perform Minecraft's pick-block input."
    },
    {
      "id": "break_targeted_once",
      "category": "Mining & Item Collection",
      "params": [],
      "purpose": "Compatibility alias for one targeted break attempt."
    },
    {
      "id": "break_once",
      "category": "Mining & Item Collection",
      "params": [],
      "purpose": "Perform one targeted break attempt."
    },
    {
      "id": "break_start",
      "category": "Mining & Item Collection",
      "params": [],
      "purpose": "Hold block-breaking input."
    },
    {
      "id": "break_stop",
      "category": "Mining & Item Collection",
      "params": [],
      "purpose": "Release block-breaking input."
    },
    {
      "id": "equip_best_tool_for_block",
      "category": "Mining & Item Collection",
      "params": [],
      "purpose": "Equip the best tool for the selected block."
    },
    {
      "id": "mine_targeted_block",
      "category": "Mining & Item Collection",
      "params": [],
      "purpose": "Mine the currently selected DAI block target."
    },
    {
      "id": "mine_nearest_block",
      "category": "Mining & Item Collection",
      "params": [
        "action",
        "ticks",
        "value"
      ],
      "purpose": "Find and mine a nearby matching block."
    },
    {
      "id": "collect_nearby_items",
      "category": "Mining & Item Collection",
      "params": [
        "action",
        "ticks",
        "value"
      ],
      "purpose": "Navigate toward and collect nearby matching item entities."
    },
    {
      "id": "place",
      "category": "Block Placement & Harvesting",
      "params": [],
      "purpose": "Perform one normal placement/use action."
    },
    {
      "id": "place_targeted_block",
      "category": "Block Placement & Harvesting",
      "params": [],
      "purpose": "Place against the selected DAI target."
    },
    {
      "id": "place_nearest_block",
      "category": "Block Placement & Harvesting",
      "params": [
        "ticks",
        "value"
      ],
      "purpose": "Find a nearby placement opportunity and place a block."
    },
    {
      "id": "place_block_at_selected_position",
      "category": "Block Placement & Harvesting",
      "params": [
        "action",
        "ticks"
      ],
      "purpose": "Physically place a requested block at the selected exact position."
    },
    {
      "id": "exact_place_align",
      "category": "Block Placement & Harvesting",
      "params": [],
      "purpose": "Internal smooth-look stage used by exact Creative placement."
    },
    {
      "id": "exact_place_finish",
      "category": "Block Placement & Harvesting",
      "params": [],
      "purpose": "Internal continuation stage used by exact placement."
    },
    {
      "id": "exact_place_verify",
      "category": "Block Placement & Harvesting",
      "params": [],
      "purpose": "Internal world-state verification stage used by exact placement."
    },
    {
      "id": "harvest_crop",
      "category": "Block Placement & Harvesting",
      "params": [
        "ticks"
      ],
      "purpose": "Harvest the selected crop target."
    },
    {
      "id": "approach_target_block",
      "category": "Navigation & Exploration",
      "params": [
        "ticks",
        "value"
      ],
      "purpose": "Navigate to a reachable interaction position near the selected block."
    },
    {
      "id": "wait_for_approach",
      "category": "Navigation & Exploration",
      "params": [
        "slot"
      ],
      "purpose": "Barrier/wait action paired with approach_target_block."
    },
    {
      "id": "wait_for_target_block",
      "category": "Navigation & Exploration",
      "params": [],
      "purpose": "Wait until the selected block is aligned/reachable for interaction."
    },
    {
      "id": "explore_for_block",
      "category": "Navigation & Exploration",
      "params": [
        "action",
        "ticks",
        "value"
      ],
      "purpose": "Explore until a matching block or block tag is discovered."
    },
    {
      "id": "wait_for_exploration",
      "category": "Navigation & Exploration",
      "params": [
        "slot"
      ],
      "purpose": "Barrier/wait action paired with explore_for_block."
    },
    {
      "id": "vertical_scaffold_to_target",
      "category": "Navigation & Exploration",
      "params": [
        "ticks",
        "value"
      ],
      "purpose": "Build/ascend a vertical scaffold toward the target."
    },
    {
      "id": "wait_for_vertical_scaffold",
      "category": "Navigation & Exploration",
      "params": [],
      "purpose": "Wait for scaffold ascent to finish."
    },
    {
      "id": "vertical_scaffold_descend",
      "category": "Navigation & Exploration",
      "params": [
        "ticks"
      ],
      "purpose": "Descend the current vertical scaffold."
    },
    {
      "id": "wait_for_scaffold_descent",
      "category": "Navigation & Exploration",
      "params": [],
      "purpose": "Wait for scaffold descent to finish."
    },
    {
      "id": "remember_waypoint",
      "category": "Waypoints",
      "params": [
        "action"
      ],
      "purpose": "Save the player's current position under a waypoint name."
    },
    {
      "id": "remember_target_waypoint",
      "category": "Waypoints",
      "params": [
        "action"
      ],
      "purpose": "Save the current selected block as a waypoint."
    },
    {
      "id": "select_waypoint",
      "category": "Waypoints",
      "params": [
        "action"
      ],
      "purpose": "Select a named waypoint as the current target."
    },
    {
      "id": "forget_waypoint",
      "category": "Waypoints",
      "params": [
        "action"
      ],
      "purpose": "Delete a named waypoint."
    },
    {
      "id": "forget_failed_waypoint",
      "category": "Waypoints",
      "params": [
        "action"
      ],
      "purpose": "Remove a waypoint from failed-waypoint memory."
    },
    {
      "id": "select_waypoint_offset",
      "category": "Spatial / Adjacency",
      "params": [
        "action",
        "direction"
      ],
      "purpose": "Select a block at waypoint + offset."
    },
    {
      "id": "remember_offset_waypoint",
      "category": "Spatial / Adjacency",
      "params": [
        "action",
        "open",
        "direction"
      ],
      "purpose": "Create a waypoint at base waypoint + offset."
    },
    {
      "id": "remember_surface_offset_waypoint",
      "category": "Spatial / Adjacency",
      "params": [
        "action",
        "open",
        "direction"
      ],
      "purpose": "Create an offset waypoint normalized to the nearby walkable surface."
    },
    {
      "id": "scan_adjacent_blocks",
      "category": "Spatial / Adjacency",
      "params": [
        "action",
        "direction"
      ],
      "purpose": "Scan blocks around a target/player/waypoint into spatial state."
    },
    {
      "id": "select_adjacent_block",
      "category": "Spatial / Adjacency",
      "params": [
        "action",
        "direction"
      ],
      "purpose": "Select one adjacent block/offset from a spatial origin."
    },
    {
      "id": "spatial_clear",
      "category": "Spatial / Adjacency",
      "params": [],
      "purpose": "Clear temporary spatial scan state."
    },
    {
      "id": "eat_best_food",
      "category": "Food",
      "params": [
        "ticks"
      ],
      "purpose": "Select/use the best available food until eating completes."
    },
    {
      "id": "open_container",
      "category": "Containers & Screen Profiles",
      "params": [
        "ticks"
      ],
      "purpose": "Interact with the selected target to open a container."
    },
    {
      "id": "wait_for_container",
      "category": "Containers & Screen Profiles",
      "params": [
        "ticks"
      ],
      "purpose": "Wait for a container screen to open."
    },
    {
      "id": "wait_for_screen_profile",
      "category": "Containers & Screen Profiles",
      "params": [
        "action",
        "ticks"
      ],
      "purpose": "Wait for a named DAI screen profile."
    },
    {
      "id": "close_container",
      "category": "Containers & Screen Profiles",
      "params": [],
      "purpose": "Close the current container screen."
    },
    {
      "id": "container_click_slot",
      "category": "Containers & Screen Profiles",
      "params": [],
      "purpose": "Click a logical container slot."
    },
    {
      "id": "container_shift_click_slot",
      "category": "Containers & Screen Profiles",
      "params": [],
      "purpose": "Shift-click a logical container slot."
    },
    {
      "id": "container_insert_item",
      "category": "Containers & Screen Profiles",
      "params": [
        "action"
      ],
      "purpose": "Insert a requested item into a matching logical slot."
    },
    {
      "id": "container_take_slot",
      "category": "Containers & Screen Profiles",
      "params": [],
      "purpose": "Take from a logical container slot."
    },
    {
      "id": "wait_for_container_slot",
      "category": "Containers & Screen Profiles",
      "params": [
        "action",
        "ticks"
      ],
      "purpose": "Wait until a logical slot matches requested criteria."
    },
    {
      "id": "delay",
      "category": "Queue & Sequences",
      "params": [
        "ticks"
      ],
      "purpose": "Wait a number of game ticks."
    },
    {
      "id": "sequence",
      "category": "Queue & Sequences",
      "params": [],
      "purpose": "Queue child actions in order."
    },
    {
      "id": "enqueue_action",
      "category": "Queue & Sequences",
      "params": [
        "action"
      ],
      "purpose": "Queue another named DAI action/objective by resource ID."
    },
    {
      "id": "queue_clear",
      "category": "Queue & Sequences",
      "params": [],
      "purpose": "Clear queued runtime actions."
    },
    {
      "id": "random_action",
      "category": "Queue & Sequences",
      "params": [
        "sequence"
      ],
      "purpose": "Choose from the supplied child action sequence."
    },
    {
      "id": "craft_recipe",
      "category": "Crafting",
      "params": [
        "action",
        "state"
      ],
      "purpose": "Craft a requested recipe."
    },
    {
      "id": "craft_take_result",
      "category": "Crafting",
      "params": [],
      "purpose": "Take the result from the active crafting output."
    },
    {
      "id": "objective_execute",
      "category": "Objectives",
      "params": [
        "action"
      ],
      "purpose": "Execute another named objective/action definition."
    },
    {
      "id": "stop_if_failure",
      "category": "Flow Control",
      "params": [],
      "purpose": "Stop queued flow when the previous action failed."
    },
    {
      "id": "stop_if_success",
      "category": "Flow Control",
      "params": [],
      "purpose": "Stop queued flow when the previous action succeeded."
    },
    {
      "id": "run_if_failure",
      "category": "Flow Control",
      "params": [],
      "purpose": "Run a referenced action when the previous action failed."
    },
    {
      "id": "run_if_success",
      "category": "Flow Control",
      "params": [],
      "purpose": "Run a referenced action when the previous action succeeded."
    },
    {
      "id": "overlay_sprite",
      "category": "Presentation & Overlays",
      "params": [
        "sprite"
      ],
      "purpose": "Add or replace a static screen sprite layer."
    },
    {
      "id": "overlay_sprite_sheet",
      "category": "Presentation & Overlays",
      "params": [
        "sprite_sheet"
      ],
      "purpose": "Add or replace an animated sprite-sheet screen layer."
    },
    {
      "id": "overlay_remove",
      "category": "Presentation & Overlays",
      "params": [
        "action"
      ],
      "purpose": "Remove one active overlay by overlay ID."
    },
    {
      "id": "overlay_clear",
      "category": "Presentation & Overlays",
      "params": [],
      "purpose": "Clear all active DAI screen overlays."
    },
    {
      "id": "customization_event",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "direction",
        "action",
        "open",
        "target",
        "value"
      ],
      "purpose": "Dispatch an event to a DAI 1.9.1 customization definition. direction=kind, action=definition id, open=event name, target=runtime payload/position, value=numeric payload."
    },
    {
      "id": "customization_activate",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "direction",
        "action",
        "open",
        "target",
        "value"
      ],
      "purpose": "Activate a DAI 1.9.1 customization definition and dispatch activate (or the event named in open)."
    },
    {
      "id": "customization_deactivate",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "direction",
        "action",
        "open",
        "target",
        "value"
      ],
      "purpose": "Deactivate a DAI 1.9.1 customization definition and dispatch deactivate (or the event named in open)."
    },
    {
      "id": "sound_play",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target",
        "value"
      ],
      "purpose": "Play/activate a dai_sounds definition."
    },
    {
      "id": "sound_stop",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action"
      ],
      "purpose": "Stop/deactivate a dai_sounds definition."
    },
    {
      "id": "music_play",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target",
        "value"
      ],
      "purpose": "Play/activate a dai_music definition."
    },
    {
      "id": "music_stop",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action"
      ],
      "purpose": "Stop/deactivate a dai_music definition."
    },
    {
      "id": "hud_show",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action"
      ],
      "purpose": "Show/activate a dai_hud definition."
    },
    {
      "id": "hud_hide",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action"
      ],
      "purpose": "Hide/deactivate a dai_hud definition."
    },
    {
      "id": "render_profile_apply",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target"
      ],
      "purpose": "Apply/activate a dai_render_profiles definition."
    },
    {
      "id": "render_profile_clear",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action"
      ],
      "purpose": "Clear/deactivate a render profile definition."
    },
    {
      "id": "structure_place",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target"
      ],
      "purpose": "Place the structure referenced by a dai_structures definition; target overrides its authored target."
    },
    {
      "id": "feature_place",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target"
      ],
      "purpose": "Place the configured feature referenced by a dai_features definition."
    },
    {
      "id": "loot_grant",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target",
        "value"
      ],
      "purpose": "Grant loot through a dai_loot definition."
    },
    {
      "id": "currency_add",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "value"
      ],
      "purpose": "Add scoreboard-backed currency; value overrides numbers.amount when non-zero."
    },
    {
      "id": "currency_take",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "value"
      ],
      "purpose": "Remove scoreboard-backed currency."
    },
    {
      "id": "currency_set",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "value"
      ],
      "purpose": "Set scoreboard-backed currency."
    },
    {
      "id": "shop_open",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target"
      ],
      "purpose": "Open/activate a dai_shops definition via its authored event/sequence."
    },
    {
      "id": "shop_purchase",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target",
        "value"
      ],
      "purpose": "Dispatch purchase to a dai_shops definition."
    },
    {
      "id": "dialogue_start",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target"
      ],
      "purpose": "Start/activate a dai_dialogues definition."
    },
    {
      "id": "dialogue_choose",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target",
        "value"
      ],
      "purpose": "Dispatch a choice payload to a dialogue."
    },
    {
      "id": "dialogue_end",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action"
      ],
      "purpose": "End/deactivate a dialogue."
    },
    {
      "id": "quest_start",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target"
      ],
      "purpose": "Start/activate a quest."
    },
    {
      "id": "quest_advance",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target",
        "value"
      ],
      "purpose": "Advance a quest with optional runtime payload/value."
    },
    {
      "id": "quest_complete",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action"
      ],
      "purpose": "Complete/deactivate a quest."
    },
    {
      "id": "quest_fail",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action"
      ],
      "purpose": "Fail/deactivate a quest."
    },
    {
      "id": "faction_join",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action"
      ],
      "purpose": "Join/activate a faction; direct default uses properties.tag."
    },
    {
      "id": "faction_leave",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action"
      ],
      "purpose": "Leave/deactivate a faction."
    },
    {
      "id": "biome_apply",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target"
      ],
      "purpose": "Dispatch apply for a biome wrapper definition."
    },
    {
      "id": "dimension_transfer",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target"
      ],
      "purpose": "Transfer through a dimension definition; target overrides authored coordinates."
    },
    {
      "id": "rules_apply",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action"
      ],
      "purpose": "Apply a ruleset; compact entries may use gamerule=value."
    },
    {
      "id": "rules_clear",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action"
      ],
      "purpose": "Clear/deactivate a ruleset through authored behavior."
    },
    {
      "id": "vehicle_spawn",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target"
      ],
      "purpose": "Spawn the vehicle entity referenced by a vehicle definition."
    },
    {
      "id": "vehicle_despawn",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action"
      ],
      "purpose": "Despawn the nearest matching vehicle."
    },
    {
      "id": "vehicle_mount",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action"
      ],
      "purpose": "Mount the nearest matching vehicle."
    },
    {
      "id": "vehicle_dismount",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action"
      ],
      "purpose": "Dismount the player."
    },
    {
      "id": "interactive_use",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target",
        "value"
      ],
      "purpose": "Dispatch use for an interactive definition."
    },
    {
      "id": "fluid_apply",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target"
      ],
      "purpose": "Apply a fluid/environment block wrapper with setblock."
    },
    {
      "id": "fluid_remove",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target"
      ],
      "purpose": "Dispatch remove/deactivate for a fluid wrapper."
    },
    {
      "id": "environment_enter",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target"
      ],
      "purpose": "Enter/activate an environment definition."
    },
    {
      "id": "environment_exit",
      "category": "Game Customization (DAI 1.9.1)",
      "params": [
        "action",
        "target"
      ],
      "purpose": "Exit/deactivate an environment definition."
    },
    {
      "id": "run_server_command",
      "category": "Server Authority (DAI 1.8+)",
      "params": [
        "action"
      ],
      "purpose": "Compatibility server-authority command request. Prefer dedicated server actions or server_run_function."
    },
    {
      "id": "server_run_function",
      "category": "Server Authority (DAI 1.8+)",
      "params": [
        "action"
      ],
      "purpose": "Run a namespaced datapack function through DAI logical-server authority."
    },
    {
      "id": "server_set_block",
      "category": "Server Authority (DAI 1.8+)",
      "params": [
        "action",
        "target"
      ],
      "purpose": "Set an authoritative block state. action=block state, target=x y z or relative coordinates."
    },
    {
      "id": "server_break_block",
      "category": "Server Authority (DAI 1.8+)",
      "params": [
        "target",
        "state"
      ],
      "purpose": "Destroy an authoritative block at target; state controls item drops."
    },
    {
      "id": "server_give_item",
      "category": "Server Authority (DAI 1.8+)",
      "params": [
        "action",
        "value"
      ],
      "purpose": "Give the acting player an item/count through server authority."
    },
    {
      "id": "server_take_item",
      "category": "Server Authority (DAI 1.8+)",
      "params": [
        "action",
        "value"
      ],
      "purpose": "Remove an item/count from the acting player through server authority."
    }
  ],
  "conditions": [
    {
      "id": "all",
      "category": "Logical Groups",
      "valueType": "boolean",
      "inputs": [
        "conditions"
      ],
      "purpose": "True when every child condition passes."
    },
    {
      "id": "any",
      "category": "Logical Groups",
      "valueType": "boolean",
      "inputs": [
        "conditions"
      ],
      "purpose": "True when at least one child condition passes."
    },
    {
      "id": "none",
      "category": "Logical Groups",
      "valueType": "boolean",
      "inputs": [
        "conditions"
      ],
      "purpose": "True when none of the child conditions pass."
    },
    {
      "id": "not",
      "category": "Logical Groups",
      "valueType": "boolean",
      "inputs": [
        "conditions"
      ],
      "purpose": "Requires exactly one child condition and inverts it."
    },
    {
      "id": "advancement_complete",
      "category": "Advancement",
      "valueType": "boolean",
      "inputs": [
        "parameter"
      ],
      "purpose": "Advancement complete"
    },
    {
      "id": "advancement_category_complete",
      "category": "Advancement",
      "valueType": "boolean",
      "inputs": [
        "parameter"
      ],
      "purpose": "Advancement category complete"
    },
    {
      "id": "block_at_offset",
      "category": "Block",
      "valueType": "value",
      "inputs": [
        "parameter"
      ],
      "purpose": "Block at offset"
    },
    {
      "id": "targeted_block_exists",
      "category": "Block",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Targeted block exists"
    },
    {
      "id": "targeted_block",
      "category": "Block",
      "valueType": "string",
      "inputs": [],
      "purpose": "Targeted block"
    },
    {
      "id": "targeted_block_breakable",
      "category": "Block",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Targeted block breakable"
    },
    {
      "id": "targeted_block_air",
      "category": "Block",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Targeted block air"
    },
    {
      "id": "block_below",
      "category": "Block",
      "valueType": "value",
      "inputs": [],
      "purpose": "Block below"
    },
    {
      "id": "block_above",
      "category": "Block",
      "valueType": "value",
      "inputs": [],
      "purpose": "Block above"
    },
    {
      "id": "block_at_feet",
      "category": "Block",
      "valueType": "value",
      "inputs": [],
      "purpose": "Block at feet"
    },
    {
      "id": "target_block_selected",
      "category": "Block",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Target block selected"
    },
    {
      "id": "attack_cooldown",
      "category": "Combat",
      "valueType": "number",
      "inputs": [],
      "purpose": "Attack cooldown"
    },
    {
      "id": "attack_ready",
      "category": "Combat",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Attack ready"
    },
    {
      "id": "player_blocking",
      "category": "Combat",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player blocking"
    },
    {
      "id": "player_recently_hurt",
      "category": "Combat",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player recently hurt"
    },
    {
      "id": "player_hurt_time",
      "category": "Combat",
      "valueType": "number",
      "inputs": [],
      "purpose": "Player hurt time"
    },
    {
      "id": "target_in_melee_reach",
      "category": "Combat",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Target in melee reach"
    },
    {
      "id": "player_effect_exists",
      "category": "Effect",
      "valueType": "boolean",
      "inputs": [
        "string_value"
      ],
      "purpose": "Player effect exists"
    },
    {
      "id": "player_effect_duration",
      "category": "Effect",
      "valueType": "number",
      "inputs": [
        "string_value"
      ],
      "purpose": "Player effect duration"
    },
    {
      "id": "player_effect_amplifier",
      "category": "Effect",
      "valueType": "number",
      "inputs": [
        "string_value"
      ],
      "purpose": "Player effect amplifier"
    },
    {
      "id": "target_effect_exists",
      "category": "Effect",
      "valueType": "boolean",
      "inputs": [
        "string_value"
      ],
      "purpose": "Target effect exists"
    },
    {
      "id": "target_effect_duration",
      "category": "Effect",
      "valueType": "number",
      "inputs": [
        "string_value"
      ],
      "purpose": "Target effect duration"
    },
    {
      "id": "target_effect_amplifier",
      "category": "Effect",
      "valueType": "number",
      "inputs": [
        "string_value"
      ],
      "purpose": "Target effect amplifier"
    },
    {
      "id": "target_entity_type",
      "category": "Entity",
      "valueType": "string",
      "inputs": [],
      "purpose": "Target entity type"
    },
    {
      "id": "target_is_living",
      "category": "Entity",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Target is living"
    },
    {
      "id": "target_is_player",
      "category": "Entity",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Target is player"
    },
    {
      "id": "target_is_hostile",
      "category": "Entity",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Target is hostile"
    },
    {
      "id": "target_is_animal",
      "category": "Entity",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Target is animal"
    },
    {
      "id": "target_is_baby",
      "category": "Entity",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Target is baby"
    },
    {
      "id": "target_is_adult",
      "category": "Entity",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Target is adult"
    },
    {
      "id": "target_name",
      "category": "Entity",
      "valueType": "string",
      "inputs": [],
      "purpose": "Target name"
    },
    {
      "id": "target_custom_name",
      "category": "Entity",
      "valueType": "string",
      "inputs": [],
      "purpose": "Target custom name"
    },
    {
      "id": "target_has_custom_name",
      "category": "Entity",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Target has custom name"
    },
    {
      "id": "biome",
      "category": "Environment",
      "valueType": "string",
      "inputs": [],
      "purpose": "Biome"
    },
    {
      "id": "biome_tag",
      "category": "Environment",
      "valueType": "boolean",
      "inputs": [
        "parameter"
      ],
      "purpose": "Biome tag"
    },
    {
      "id": "fluid_at_feet",
      "category": "Environment",
      "valueType": "value",
      "inputs": [],
      "purpose": "Fluid at feet"
    },
    {
      "id": "fluid_below",
      "category": "Environment",
      "valueType": "value",
      "inputs": [],
      "purpose": "Fluid below"
    },
    {
      "id": "player_underwater",
      "category": "Environment",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player underwater"
    },
    {
      "id": "player_in_rain",
      "category": "Environment",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player in rain"
    },
    {
      "id": "player_in_powder_snow",
      "category": "Environment",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player in powder snow"
    },
    {
      "id": "underground",
      "category": "Environment",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Underground"
    },
    {
      "id": "open_sky",
      "category": "Environment",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Open sky"
    },
    {
      "id": "sky_light",
      "category": "Environment",
      "valueType": "number",
      "inputs": [],
      "purpose": "Sky light"
    },
    {
      "id": "block_light",
      "category": "Environment",
      "valueType": "number",
      "inputs": [],
      "purpose": "Block light"
    },
    {
      "id": "equipment_item",
      "category": "Equipment",
      "valueType": "string",
      "inputs": [
        "parameter"
      ],
      "purpose": "Equipment item"
    },
    {
      "id": "equipment_empty",
      "category": "Equipment",
      "valueType": "boolean",
      "inputs": [
        "parameter"
      ],
      "purpose": "Equipment empty"
    },
    {
      "id": "equipment_stack_size",
      "category": "Equipment",
      "valueType": "number",
      "inputs": [
        "parameter"
      ],
      "purpose": "Equipment stack size"
    },
    {
      "id": "equipment_durability",
      "category": "Equipment",
      "valueType": "number",
      "inputs": [
        "parameter"
      ],
      "purpose": "Equipment durability"
    },
    {
      "id": "equipment_damage",
      "category": "Equipment",
      "valueType": "number",
      "inputs": [
        "parameter"
      ],
      "purpose": "Equipment damage"
    },
    {
      "id": "equipment_max_damage",
      "category": "Equipment",
      "valueType": "number",
      "inputs": [
        "parameter"
      ],
      "purpose": "Equipment max damage"
    },
    {
      "id": "player_facing_target",
      "category": "Geometry",
      "valueType": "boolean",
      "inputs": [
        "parameter_number"
      ],
      "purpose": "Player facing target"
    },
    {
      "id": "target_in_front",
      "category": "Geometry",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Target in front"
    },
    {
      "id": "target_behind",
      "category": "Geometry",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Target behind"
    },
    {
      "id": "target_left",
      "category": "Geometry",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Target left"
    },
    {
      "id": "target_right",
      "category": "Geometry",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Target right"
    },
    {
      "id": "horizontal_angle_to_target",
      "category": "Geometry",
      "valueType": "number",
      "inputs": [],
      "purpose": "Horizontal angle to target"
    },
    {
      "id": "vertical_angle_to_target",
      "category": "Geometry",
      "valueType": "number",
      "inputs": [],
      "purpose": "Vertical angle to target"
    },
    {
      "id": "distance_to_position",
      "category": "Geometry",
      "valueType": "number",
      "inputs": [
        "parameter"
      ],
      "purpose": "Distance to position"
    },
    {
      "id": "holding_item",
      "category": "Inventory",
      "valueType": "string",
      "inputs": [],
      "purpose": "Holding item"
    },
    {
      "id": "offhand_item",
      "category": "Inventory",
      "valueType": "string",
      "inputs": [],
      "purpose": "Offhand item"
    },
    {
      "id": "inventory_has_space",
      "category": "Inventory",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Inventory has space"
    },
    {
      "id": "selected_hotbar_slot",
      "category": "Inventory",
      "valueType": "number",
      "inputs": [],
      "purpose": "Selected hotbar slot"
    },
    {
      "id": "mainhand_empty",
      "category": "Inventory",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Mainhand empty"
    },
    {
      "id": "offhand_empty",
      "category": "Inventory",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Offhand empty"
    },
    {
      "id": "container_has_item",
      "category": "Inventory",
      "valueType": "number",
      "inputs": [
        "parameter"
      ],
      "purpose": "Container has item"
    },
    {
      "id": "recipe_unlocked",
      "category": "Inventory",
      "valueType": "boolean",
      "inputs": [
        "parameter"
      ],
      "purpose": "Recipe unlocked"
    },
    {
      "id": "inventory_item_count",
      "category": "Item",
      "valueType": "number",
      "inputs": [
        "parameter"
      ],
      "purpose": "Inventory item count"
    },
    {
      "id": "mainhand_stack_size",
      "category": "Item",
      "valueType": "number",
      "inputs": [],
      "purpose": "Mainhand stack size"
    },
    {
      "id": "offhand_stack_size",
      "category": "Item",
      "valueType": "number",
      "inputs": [],
      "purpose": "Offhand stack size"
    },
    {
      "id": "mainhand_damage",
      "category": "Item",
      "valueType": "number",
      "inputs": [],
      "purpose": "Mainhand damage"
    },
    {
      "id": "mainhand_max_damage",
      "category": "Item",
      "valueType": "number",
      "inputs": [],
      "purpose": "Mainhand max damage"
    },
    {
      "id": "mainhand_durability",
      "category": "Item",
      "valueType": "number",
      "inputs": [],
      "purpose": "Mainhand durability"
    },
    {
      "id": "offhand_damage",
      "category": "Item",
      "valueType": "number",
      "inputs": [],
      "purpose": "Offhand damage"
    },
    {
      "id": "offhand_max_damage",
      "category": "Item",
      "valueType": "number",
      "inputs": [],
      "purpose": "Offhand max damage"
    },
    {
      "id": "offhand_durability",
      "category": "Item",
      "valueType": "number",
      "inputs": [],
      "purpose": "Offhand durability"
    },
    {
      "id": "biome_known",
      "category": "Knowledge",
      "valueType": "boolean",
      "inputs": [
        "parameter"
      ],
      "purpose": "Biome known"
    },
    {
      "id": "structure_known",
      "category": "Knowledge",
      "valueType": "boolean",
      "inputs": [
        "parameter"
      ],
      "purpose": "Structure known"
    },
    {
      "id": "player_game_mode",
      "category": "Mode",
      "valueType": "string",
      "inputs": [],
      "purpose": "Player game mode"
    },
    {
      "id": "player_survival",
      "category": "Mode",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player survival"
    },
    {
      "id": "player_creative",
      "category": "Mode",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player creative"
    },
    {
      "id": "player_adventure",
      "category": "Mode",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player adventure"
    },
    {
      "id": "player_spectator",
      "category": "Mode",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player spectator"
    },
    {
      "id": "player_flying",
      "category": "Mode",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player flying"
    },
    {
      "id": "player_can_fly",
      "category": "Mode",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player can fly"
    },
    {
      "id": "player_invulnerable",
      "category": "Mode",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player invulnerable"
    },
    {
      "id": "player_instabuild",
      "category": "Mode",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player instabuild"
    },
    {
      "id": "player_may_build",
      "category": "Mode",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player may build"
    },
    {
      "id": "player_moving",
      "category": "Movement",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player moving"
    },
    {
      "id": "player_stationary",
      "category": "Movement",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player stationary"
    },
    {
      "id": "player_in_air",
      "category": "Movement",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player in air"
    },
    {
      "id": "player_falling",
      "category": "Movement",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player falling"
    },
    {
      "id": "player_rising",
      "category": "Movement",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player rising"
    },
    {
      "id": "player_horizontal_speed",
      "category": "Movement",
      "valueType": "number",
      "inputs": [],
      "purpose": "Player horizontal speed"
    },
    {
      "id": "player_vertical_speed",
      "category": "Movement",
      "valueType": "number",
      "inputs": [],
      "purpose": "Player vertical speed"
    },
    {
      "id": "player_speed",
      "category": "Movement",
      "valueType": "number",
      "inputs": [],
      "purpose": "Player speed"
    },
    {
      "id": "player_swimming",
      "category": "Movement",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player swimming"
    },
    {
      "id": "player_fall_flying",
      "category": "Movement",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player fall flying"
    },
    {
      "id": "player_climbing",
      "category": "Movement",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player climbing"
    },
    {
      "id": "player_stuck",
      "category": "MovementProgress",
      "valueType": "boolean",
      "inputs": [
        "parameter_number",
        "number_value"
      ],
      "purpose": "Player stuck"
    },
    {
      "id": "distance_moved_recently",
      "category": "MovementProgress",
      "valueType": "number",
      "inputs": [
        "parameter_number"
      ],
      "purpose": "Distance moved recently"
    },
    {
      "id": "path_forward_clear",
      "category": "Navigation",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Path forward clear"
    },
    {
      "id": "path_forward_step_up",
      "category": "Navigation",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Path forward step up"
    },
    {
      "id": "path_forward_blocked",
      "category": "Navigation",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Path forward blocked"
    },
    {
      "id": "path_forward_safe_drop",
      "category": "Navigation",
      "valueType": "boolean",
      "inputs": [
        "parameter_number"
      ],
      "purpose": "Path forward safe drop"
    },
    {
      "id": "path_forward_dangerous_drop",
      "category": "Navigation",
      "valueType": "boolean",
      "inputs": [
        "parameter_number"
      ],
      "purpose": "Path forward dangerous drop"
    },
    {
      "id": "path_forward_lava",
      "category": "Navigation",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Path forward lava"
    },
    {
      "id": "path_forward_safe",
      "category": "Navigation",
      "valueType": "boolean",
      "inputs": [
        "parameter_number"
      ],
      "purpose": "Path forward safe"
    },
    {
      "id": "player_has_jump_headroom",
      "category": "Navigation",
      "valueType": "boolean",
      "inputs": [
        "parameter_number"
      ],
      "purpose": "Player has jump headroom"
    },
    {
      "id": "path_forward_elevation",
      "category": "Navigation",
      "valueType": "number",
      "inputs": [
        "parameter_number"
      ],
      "purpose": "Path forward elevation"
    },
    {
      "id": "path_forward_uphill",
      "category": "Navigation",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Path forward uphill"
    },
    {
      "id": "path_forward_downhill",
      "category": "Navigation",
      "valueType": "boolean",
      "inputs": [
        "parameter_number"
      ],
      "purpose": "Path forward downhill"
    },
    {
      "id": "nearby_recognition",
      "category": "Nearby",
      "valueType": "boolean",
      "inputs": [
        "parameter",
        "parameter_number",
        "number_value"
      ],
      "purpose": "Nearby recognition"
    },
    {
      "id": "nearby_entity_count",
      "category": "Nearby",
      "valueType": "number",
      "inputs": [
        "parameter",
        "parameter_number"
      ],
      "purpose": "Nearby entity count"
    },
    {
      "id": "nearest_entity_distance",
      "category": "Nearby",
      "valueType": "number",
      "inputs": [
        "parameter",
        "parameter_number"
      ],
      "purpose": "Nearest entity distance"
    },
    {
      "id": "nearby_item_count",
      "category": "NearbyItem",
      "valueType": "number",
      "inputs": [
        "parameter_number"
      ],
      "purpose": "Nearby item count"
    },
    {
      "id": "nearest_item_distance",
      "category": "NearbyItem",
      "valueType": "number",
      "inputs": [
        "parameter_number"
      ],
      "purpose": "Nearest item distance"
    },
    {
      "id": "nearby_experience_orb_count",
      "category": "NearbyItem",
      "valueType": "number",
      "inputs": [
        "parameter_number"
      ],
      "purpose": "Nearby experience orb count"
    },
    {
      "id": "nearest_experience_orb_distance",
      "category": "NearbyItem",
      "valueType": "number",
      "inputs": [
        "parameter_number"
      ],
      "purpose": "Nearest experience orb distance"
    },
    {
      "id": "player_exists",
      "category": "Player",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player exists"
    },
    {
      "id": "player_alive",
      "category": "Player",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player alive"
    },
    {
      "id": "player_health",
      "category": "Player",
      "valueType": "number",
      "inputs": [],
      "purpose": "Player health"
    },
    {
      "id": "player_on_ground",
      "category": "Player",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player on ground"
    },
    {
      "id": "player_sprinting",
      "category": "Player",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player sprinting"
    },
    {
      "id": "player_sneaking",
      "category": "Player",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player sneaking"
    },
    {
      "id": "player_using_item",
      "category": "Player",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player using item"
    },
    {
      "id": "player_hunger",
      "category": "Player",
      "valueType": "number",
      "inputs": [],
      "purpose": "Player hunger"
    },
    {
      "id": "player_air",
      "category": "Player",
      "valueType": "number",
      "inputs": [],
      "purpose": "Player air"
    },
    {
      "id": "player_in_water",
      "category": "Player",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player in water"
    },
    {
      "id": "player_in_lava",
      "category": "Player",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player in lava"
    },
    {
      "id": "player_on_fire",
      "category": "Player",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Player on fire"
    },
    {
      "id": "player_x",
      "category": "Position",
      "valueType": "number",
      "inputs": [],
      "purpose": "Player x"
    },
    {
      "id": "player_y",
      "category": "Position",
      "valueType": "number",
      "inputs": [],
      "purpose": "Player y"
    },
    {
      "id": "player_z",
      "category": "Position",
      "valueType": "number",
      "inputs": [],
      "purpose": "Player z"
    },
    {
      "id": "player_block_x",
      "category": "Position",
      "valueType": "number",
      "inputs": [],
      "purpose": "Player block x"
    },
    {
      "id": "player_block_y",
      "category": "Position",
      "valueType": "number",
      "inputs": [],
      "purpose": "Player block y"
    },
    {
      "id": "player_block_z",
      "category": "Position",
      "valueType": "number",
      "inputs": [],
      "purpose": "Player block z"
    },
    {
      "id": "player_yaw",
      "category": "Position",
      "valueType": "number",
      "inputs": [],
      "purpose": "Player yaw"
    },
    {
      "id": "player_pitch",
      "category": "Position",
      "valueType": "number",
      "inputs": [],
      "purpose": "Player pitch"
    },
    {
      "id": "player_facing",
      "category": "Position",
      "valueType": "string",
      "inputs": [],
      "purpose": "Player facing"
    },
    {
      "id": "target_x",
      "category": "Position",
      "valueType": "number",
      "inputs": [],
      "purpose": "Target x"
    },
    {
      "id": "target_y",
      "category": "Position",
      "valueType": "number",
      "inputs": [],
      "purpose": "Target y"
    },
    {
      "id": "target_z",
      "category": "Position",
      "valueType": "number",
      "inputs": [],
      "purpose": "Target z"
    },
    {
      "id": "target_above_player",
      "category": "Position",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Target above player"
    },
    {
      "id": "target_below_player",
      "category": "Position",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Target below player"
    },
    {
      "id": "target_height_difference",
      "category": "Position",
      "valueType": "number",
      "inputs": [],
      "purpose": "Target height difference"
    },
    {
      "id": "always",
      "category": "Registry",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Always"
    },
    {
      "id": "never",
      "category": "Registry",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Never"
    },
    {
      "id": "approach_last_success",
      "category": "Scaffold",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Approach last success"
    },
    {
      "id": "approach_last_failed",
      "category": "Scaffold",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Approach last failed"
    },
    {
      "id": "scaffold_last_success",
      "category": "Scaffold",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Scaffold last success"
    },
    {
      "id": "scaffold_last_failed",
      "category": "Scaffold",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Scaffold last failed"
    },
    {
      "id": "scaffold_active",
      "category": "Scaffold",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Scaffold active"
    },
    {
      "id": "scaffold_used_count",
      "category": "Scaffold",
      "valueType": "number",
      "inputs": [],
      "purpose": "Scaffold used count"
    },
    {
      "id": "scaffold_material_count",
      "category": "Scaffold",
      "valueType": "number",
      "inputs": [],
      "purpose": "Scaffold material count"
    },
    {
      "id": "block_at_waypoint_offset",
      "category": "Spatial",
      "valueType": "value",
      "inputs": [
        "parameter"
      ],
      "purpose": "Block at waypoint offset"
    },
    {
      "id": "waypoint_offset_air",
      "category": "Spatial",
      "valueType": "boolean",
      "inputs": [
        "parameter"
      ],
      "purpose": "Waypoint offset air"
    },
    {
      "id": "waypoint_offset_strict_air",
      "category": "Spatial",
      "valueType": "boolean",
      "inputs": [
        "parameter"
      ],
      "purpose": "Waypoint offset strict air"
    },
    {
      "id": "waypoint_offset_house_plank",
      "category": "Spatial",
      "valueType": "boolean",
      "inputs": [
        "parameter"
      ],
      "purpose": "Waypoint offset house plank"
    },
    {
      "id": "waypoint_offset_traversable",
      "category": "Spatial",
      "valueType": "boolean",
      "inputs": [
        "parameter"
      ],
      "purpose": "Waypoint offset traversable"
    },
    {
      "id": "selected_block",
      "category": "Spatial",
      "valueType": "value",
      "inputs": [],
      "purpose": "Selected block"
    },
    {
      "id": "selected_block_air",
      "category": "Spatial",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Selected block air"
    },
    {
      "id": "selected_block_traversable",
      "category": "Spatial",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Selected block traversable"
    },
    {
      "id": "spatial_scan_available",
      "category": "Spatial",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Spatial scan available"
    },
    {
      "id": "spatial_scan_size",
      "category": "Spatial",
      "valueType": "number",
      "inputs": [],
      "purpose": "Spatial scan size"
    },
    {
      "id": "adjacent_block",
      "category": "Spatial",
      "valueType": "value",
      "inputs": [
        "parameter"
      ],
      "purpose": "Adjacent block"
    },
    {
      "id": "adjacent_block_air",
      "category": "Spatial",
      "valueType": "boolean",
      "inputs": [
        "parameter"
      ],
      "purpose": "Adjacent block air"
    },
    {
      "id": "adjacent_block_traversable",
      "category": "Spatial",
      "valueType": "boolean",
      "inputs": [
        "parameter"
      ],
      "purpose": "Adjacent block traversable"
    },
    {
      "id": "adjacent_block_count",
      "category": "Spatial",
      "valueType": "number",
      "inputs": [
        "parameter"
      ],
      "purpose": "Adjacent block count"
    },
    {
      "id": "last_action_running",
      "category": "Status",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Last action running"
    },
    {
      "id": "last_action_success",
      "category": "Status",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Last action success"
    },
    {
      "id": "last_action_failure",
      "category": "Status",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Last action failure"
    },
    {
      "id": "last_action_cancelled",
      "category": "Status",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Last action cancelled"
    },
    {
      "id": "last_action_timed_out",
      "category": "Status",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Last action timed out"
    },
    {
      "id": "holding_item_tag",
      "category": "Tag",
      "valueType": "boolean",
      "inputs": [
        "parameter"
      ],
      "purpose": "Holding item tag"
    },
    {
      "id": "offhand_item_tag",
      "category": "Tag",
      "valueType": "boolean",
      "inputs": [
        "parameter"
      ],
      "purpose": "Offhand item tag"
    },
    {
      "id": "inventory_item_tag_count",
      "category": "Tag",
      "valueType": "number",
      "inputs": [
        "parameter"
      ],
      "purpose": "Inventory item tag count"
    },
    {
      "id": "equipment_item_tag",
      "category": "Tag",
      "valueType": "boolean",
      "inputs": [
        "parameter"
      ],
      "purpose": "Equipment item tag"
    },
    {
      "id": "targeted_block_tag",
      "category": "Tag",
      "valueType": "boolean",
      "inputs": [
        "parameter"
      ],
      "purpose": "Targeted block tag"
    },
    {
      "id": "target_exists",
      "category": "Target",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Target exists"
    },
    {
      "id": "target_alive",
      "category": "Target",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Target alive"
    },
    {
      "id": "target_health",
      "category": "Target",
      "valueType": "number",
      "inputs": [],
      "purpose": "Target health"
    },
    {
      "id": "target_distance",
      "category": "Target",
      "valueType": "number",
      "inputs": [],
      "purpose": "Target distance"
    },
    {
      "id": "target_visible",
      "category": "Target",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Target visible"
    },
    {
      "id": "waypoint_known",
      "category": "Waypoint",
      "valueType": "boolean",
      "inputs": [
        "parameter"
      ],
      "purpose": "Waypoint known"
    },
    {
      "id": "waypoint_in_dimension",
      "category": "Waypoint",
      "valueType": "boolean",
      "inputs": [
        "parameter"
      ],
      "purpose": "Waypoint in dimension"
    },
    {
      "id": "distance_to_waypoint",
      "category": "Waypoint",
      "valueType": "number",
      "inputs": [
        "parameter"
      ],
      "purpose": "Distance to waypoint"
    },
    {
      "id": "at_waypoint",
      "category": "Waypoint",
      "valueType": "boolean",
      "inputs": [
        "parameter",
        "number_value"
      ],
      "purpose": "At waypoint"
    },
    {
      "id": "world_time",
      "category": "World",
      "valueType": "number",
      "inputs": [],
      "purpose": "World time"
    },
    {
      "id": "game_time",
      "category": "World",
      "valueType": "number",
      "inputs": [],
      "purpose": "Game time"
    },
    {
      "id": "day_count",
      "category": "World",
      "valueType": "number",
      "inputs": [],
      "purpose": "Day count"
    },
    {
      "id": "is_day",
      "category": "World",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Is day"
    },
    {
      "id": "is_night",
      "category": "World",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Is night"
    },
    {
      "id": "is_raining",
      "category": "World",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Is raining"
    },
    {
      "id": "is_thundering",
      "category": "World",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Is thundering"
    },
    {
      "id": "dimension",
      "category": "World",
      "valueType": "string",
      "inputs": [],
      "purpose": "Dimension"
    },
    {
      "id": "sky_visible",
      "category": "World",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Sky visible"
    },
    {
      "id": "light_level",
      "category": "World",
      "valueType": "number",
      "inputs": [],
      "purpose": "Light level"
    },
    {
      "id": "reaction_active",
      "category": "Reactions",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "A DAI reaction event context is currently active."
    },
    {
      "id": "reaction_event",
      "category": "Reactions",
      "valueType": "string",
      "inputs": [],
      "purpose": "Current reaction event ID."
    },
    {
      "id": "reaction_phase",
      "category": "Reactions",
      "valueType": "string",
      "inputs": [],
      "purpose": "Current reaction phase: pre, during, or post."
    },
    {
      "id": "reaction_has_entity",
      "category": "Reactions",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Current reaction exposes an entity context."
    },
    {
      "id": "reaction_entity_type",
      "category": "Reactions",
      "valueType": "string",
      "inputs": [],
      "purpose": "Resource ID of the reaction entity, such as minecraft:zombie."
    },
    {
      "id": "reaction_entity_living",
      "category": "Reactions",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Reaction entity is a living entity."
    },
    {
      "id": "reaction_entity_health",
      "category": "Reactions",
      "valueType": "number",
      "inputs": [],
      "purpose": "Current health of the reaction living entity."
    },
    {
      "id": "customization_exists",
      "category": "Game Customization (DAI 1.9.1)",
      "valueType": "boolean",
      "inputs": [
        "target",
        "string_value"
      ],
      "purpose": "True when the named customization definition exists. target=kind/folder, string_value=definition id."
    },
    {
      "id": "customization_active",
      "category": "Game Customization (DAI 1.9.1)",
      "valueType": "boolean",
      "inputs": [
        "target",
        "string_value"
      ],
      "purpose": "True when the named customization definition is active. target=kind/folder, string_value=definition id."
    },
    {
      "id": "customization_count",
      "category": "Game Customization (DAI 1.9.1)",
      "valueType": "number",
      "inputs": [
        "string_value"
      ],
      "purpose": "Number of registered definitions for the kind supplied in string_value."
    },
    {
      "id": "reaction_has_block",
      "category": "Reactions (DAI 1.9.1)",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Current reaction exposes a block position."
    },
    {
      "id": "reaction_block_id",
      "category": "Reactions (DAI 1.9.1)",
      "valueType": "string",
      "inputs": [],
      "purpose": "Block resource ID at the current reaction block position."
    },
    {
      "id": "reaction_block_x",
      "category": "Reactions (DAI 1.9.1)",
      "valueType": "number",
      "inputs": [],
      "purpose": "X coordinate of the current reaction block position."
    },
    {
      "id": "reaction_block_y",
      "category": "Reactions (DAI 1.9.1)",
      "valueType": "number",
      "inputs": [],
      "purpose": "Y coordinate of the current reaction block position."
    },
    {
      "id": "reaction_block_z",
      "category": "Reactions (DAI 1.9.1)",
      "valueType": "number",
      "inputs": [],
      "purpose": "Z coordinate of the current reaction block position."
    },
    {
      "id": "reaction_has_item",
      "category": "Reactions (DAI 1.9.1)",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Current reaction exposes a held/used item ID."
    },
    {
      "id": "reaction_item_id",
      "category": "Reactions (DAI 1.9.1)",
      "valueType": "string",
      "inputs": [],
      "purpose": "Held/used item resource ID for the current reaction."
    },
    {
      "id": "dai_server_available",
      "category": "Server Capability (DAI 1.8+)",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "DAI server payload channel is available."
    },
    {
      "id": "server_dai_available",
      "category": "Server Capability (DAI 1.8+)",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Compatibility alias: DAI server support is available."
    },
    {
      "id": "server_authority_available",
      "category": "Server Capability (DAI 1.8+)",
      "valueType": "boolean",
      "inputs": [],
      "purpose": "Server-authoritative DAI actions are available."
    }
  ],
  "operators": {
    "boolean": [
      "is_true",
      "is_false",
      "equals",
      "not_equals"
    ],
    "number": [
      "equals",
      "not_equals",
      "less_than",
      "less_than_or_equal",
      "greater_than",
      "greater_than_or_equal"
    ],
    "string": [
      "equals",
      "not_equals",
      "equals_ignore_case",
      "contains",
      "starts_with",
      "ends_with"
    ],
    "value": [
      "is_true",
      "is_false",
      "equals",
      "not_equals",
      "less_than",
      "less_than_or_equal",
      "greater_than",
      "greater_than_or_equal",
      "equals_ignore_case",
      "contains",
      "starts_with",
      "ends_with"
    ]
  },
  "recognitionRequirements": [
    "connected",
    "vertical_column",
    "touches_ground",
    "near_upper_region",
    "contains_group",
    "dimensions",
    "group_ratio"
  ],
  "overlayAnchors": [
    "top_left",
    "top_center",
    "top_right",
    "center_left",
    "center",
    "center_right",
    "bottom_left",
    "bottom_center",
    "bottom_right"
  ],
  "reactionEvents": [
    {
      "id": "player_attack_entity",
      "phases": [
        "pre",
        "during",
        "post"
      ],
      "cancellable": true,
      "overrideable": true,
      "entityContext": true,
      "purpose": "Fires around the normal client entity-attack call; exposes the attacked entity."
    },
    {
      "id": "player_use_block",
      "phases": [
        "pre",
        "during",
        "post"
      ],
      "cancellable": true,
      "overrideable": true,
      "entityContext": false,
      "purpose": "Fires around use-on-block; exposes block position and used item."
    },
    {
      "id": "player_use_item",
      "phases": [
        "pre",
        "during",
        "post"
      ],
      "cancellable": true,
      "overrideable": true,
      "entityContext": false,
      "purpose": "Fires around item use; exposes the used item."
    },
    {
      "id": "player_interact_entity",
      "phases": [
        "pre",
        "during",
        "post"
      ],
      "cancellable": true,
      "overrideable": true,
      "entityContext": true,
      "purpose": "Fires around entity interaction; exposes entity and used item."
    },
    {
      "id": "player_start_break_block",
      "phases": [
        "pre",
        "during",
        "post"
      ],
      "cancellable": true,
      "overrideable": true,
      "entityContext": false,
      "purpose": "Fires when starting a block break; exposes block position and held item."
    }
  ]
};
