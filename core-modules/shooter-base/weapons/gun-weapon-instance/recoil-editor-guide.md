# Recoil Editor Guide

The **Recoil Editor** is a powerful visual tool included with the `ShooterBase` plugin, designed to make creating and tuning weapon recoil a fast, intuitive, and creative process.

Instead of tweaking numbers in a details panel and constantly play-testing, this editor gives you an immediate, interactive graph of your weapon's recoil pattern and its associated spread. You can directly manipulate the recoil path, see the results in real-time, and save your changes back to the weapon Blueprint with a single click.

### Accessing the Editor

You can open the Recoil Editor at any time from the main Unreal Engine menu bar:

1. Click **Window** in the top menu.
2. Select **Recoil Editor**.

This will open the editor in a new tab.

<img src=".gitbook/assets/image (1).png" alt="" title="">

### Editor Interface Overview

The editor is composed of three main sections. Understanding each one is key to an efficient workflow.

1. **Graph View:** This is your canvas. The yellow line and points represent the recoil path your weapon's aim will follow. You'll do most of your creative work here by adding, moving, and deleting points.
2. **Toolbar:** Contains all the essential actions for managing your graph, such as loading a pattern, saving your work, resetting the view, and more.
3.  **Details & Properties Panel:** This is your control center.

    * The top section lets you **select the weapon class** (`UGunWeaponInstance` Blueprint) you want to edit.
    * The bottom section displays all the properties from that weapon's Class Default Object (CDO), allowing you to see and modify other values like spread multipliers or recovery speeds right from the editor.

    <img src=".gitbook/assets/image (2).png" alt="" title="">

***

### Workflow: Creating and Tuning a Recoil Pattern

Follow these steps to go from a blank slate to a fully tuned recoil pattern.

**Step 1: Select a Weapon**

In the **Details Panel**, click the dropdown for **Selected Weapon Class** and choose the weapon Blueprint you want to edit. This must be a Blueprint that inherits from `UGunWeaponInstance`.

**Step 2: Load the Existing Pattern**

Click the **Load Recoil** button on the toolbar. This will read the `VerticalRecoilCurve` and `HorizontalRecoilCurve` from your selected weapon and populate the **Graph View** with its current pattern. If it's a new weapon, you'll likely see a very simple starting pattern.

**Step 3: Edit the Recoil Path**

This is where you define the weapon's feel. Interact with the graph using your mouse:

* **Add a Shot:**
  * To add a new shot at the end of the recoil pattern, **Left-click** in any empty space.
  * To insert a shot in the middle of the pattern, **Left-click** on the yellow line between two existing points.
* **Move a Shot:** **Click and drag** any point to change its position. The path will update in real-time.
* **Delete a Shot:** **Right-click** a point and select "Delete" from the context menu, or select a point and press the **Delete** key.
* **Select Multiple Shots:** **Drag a selection box** with the left mouse button to select a group of points to move or delete together.

**Step 4: Understand the Visuals**

The graph gives you all the information you need at a glance:

* **The Path (Yellow Line):** This shows the exact path the player's aim will travel as they fire continuously.
* **The Shots (Red/Green Points):** Each point represents a single shot in the burst.
  * **Vertical Axis:** Controls the vertical "kick". Higher on the graph means more upward kick.
  * **Horizontal Axis:** Controls the side-to-side kick.
* **The Spread (Yellow Circles):** Each shot point is surrounded by a circle representing the weapon's potential bullet spread at that moment. The editor automatically calculates this based on the weapon's heat and spread properties inherited from `ULyraRangedWeaponInstance`.

**Step 5: Edit the Spread**

You can tune the spread for each individual shot directly in the editor:

1. Hover your mouse over a point in the graph.
2. Use the **Mouse Wheel** to increase or decrease the size of its yellow spread circle.

This is perfect for creating patterns where accuracy gets worse over a long burst, or for making the first few shots highly accurate.

**Step 6: Save Your Work**

Once you are satisfied with the pattern, click the **Save Recoil** button in the toolbar. This action does two things:

1. It updates the `VerticalRecoilCurve`, `HorizontalRecoilCurve`, and `HeatToSpreadCurve` properties on the actual weapon Blueprint asset.
2. It marks the Blueprint asset as dirty, so you can save it in the Content Browser.

Your weapon is now ready to be tested in-game with its new recoil!

***

### Toolbar Actions Quick Reference

| Icon      | Name            | Description                                                                              |
| --------- | --------------- | ---------------------------------------------------------------------------------------- |
| (Save)    | **Save Recoil** | Writes the current graph pattern to the selected weapon's Blueprint asset.               |
| (Load)    | **Load Recoil** | Reads the recoil pattern from the selected weapon and displays it in the graph.          |
| (Delete)  | **Delete**      | Deletes the currently selected point(s).                                                 |
| (Refresh) | **Reset Grid**  | Resets the grid's pan and zoom to focus on the origin point (0,0).                       |
| (Fit)     | **Fit to Grid** | Automatically adjusts the pan and zoom to fit the entire recoil pattern within the view. |
