# Data Layers (View Models)

In the Model-View-ViewModel (MVVM) pattern, the **ViewModel** is the most critical component. It acts as the translator.

* **The Model (Server):** Raw, efficient, and ugly. It deals with `TArray` indices, replication keys, and network serialization. It doesn't care about icons or tooltips.
* **The View (UMG):** Purely visual. It knows how to draw a border and play an animation, but it has no idea what an "Inventory Item" is.
* **The ViewModel (The Translator):** It sits in the middle. It listens to the Model, converts the raw data into human-readable text and textures, and exposes it to the View via `FieldNotify`.

This architecture solves the biggest problem in Unreal UI development: **Spaghetti Code**. Your UMG widgets no longer contain cast nodes, server RPCs, or complex loop logic. They simply bind to properties like `ItemName` or `IsOccupied`.

### The Three Pillars of Data

We split our data representation into three distinct layers to handle the complexity of different container types (Inventory vs. Equipment vs. Attachments).

#### 1. The Container (`ULyraContainerViewModel`)

This represents the "Box." It manages the list of items as a whole.

* **Responsibility:** Rebuilding the list when the server replicates new data.
* **Caching:** It keeps a map of active item ViewModels to ensure that if an item moves from Slot 1 to Slot 2, its selection state and focus are preserved.
* **Calculations:** It sums up total weight and item counts.

#### 2. The Slot (`ULyraSlotViewModelBase`)

This represents a specific **Position** inside the container.

* **The Problem:** In UMG, you cannot bind to "Nothing." If an inventory slot is empty, you still need an object to represent that empty space so you can draw the background and accept Drag-and-Drop events.
* **The Solution:** Slot ViewModels are **Permanent**. They exist even when empty. They act as a stable anchor for your UMG widgets.

#### 3. The Item (`ULyraItemViewModel`)

This represents the **Data** itself.

* **Responsibility:** It wraps the `ULyraInventoryItemInstance`.
* **Updates:** It listens for tag changes (e.g., Ammo Count changing) and updates the UI instantly without rebuilding the entire list.
* **Proxying:** The Slot "proxies" data from the Item. Your widget binds to `Slot->ItemIcon`. If the item exists, it shows the icon. If not, it shows a default transparent image.

### In This Section

We will explore how these three layers interact to create a seamless data flow:

* [**Container Logic**](container-logic.md)
  * The `RebuildItemsList` loop.
  * How the `ItemViewModelCache` prevents UI flickering.
* [**The Persistent Slot Pattern**](persistent-slot-pattern.md)
  * Why we separate Slots from Items.
  * How Proxy Properties solve the "Null Binding" error.
* [**Prediction & Visuals**](prediction-and-visuals.md)
  * How the view models work with the item prediction system
  * What `bGhost` represents and it's intended usage.
* [**Specialized Implementations**](specialized-implementations.md)
  * **Inventory:** Index-based logic.
  * **Equipment:** Tag-based slots (Head, Chest, Hands).
  * **Attachments:** Hierarchical paths (The "Item-on-Item" problem).
