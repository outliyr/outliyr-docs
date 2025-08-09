# Grid-Specific Gameplay Messages

While many UI updates can be driven by messages from the base inventory system (like `TAG_Lyra_Inventory_Message_StackChanged`), the Tetris Inventory introduces spatial concepts that require specific messages to keep the UI synchronized with grid state changes.

These messages are broadcast by the `ULyraTetrisInventoryManagerComponent` (primarily via its `FGridCellInfoList`) when relevant events occur, allowing UI widgets and other systems to react appropriately without direct coupling.

### `TAG_Lyra_Inventory_Message_GridCellChanged`

This is the most fundamental message for Tetris UI updates, indicating that the state of one or more individual grid cells has changed.

* **Tag:** `Lyra.Inventory.Message.GridCellChanged`
*   **Payload Struct:** `FGridInventoryChangedMessage`

    ```cpp
    USTRUCT(BlueprintType)
    struct FGridInventoryChangedMessage
    {
        GENERATED_BODY()

        // The inventory component whose grid cell changed.
        UPROPERTY(BlueprintReadOnly, Category=Inventory)
        TObjectPtr<UActorComponent> InventoryOwner = nullptr; // Usually ULyraTetrisInventoryManagerComponent

        // The item instance now occupying the root of this cell (or nullptr if empty).
        UPROPERTY(BlueprintReadOnly, Category = Inventory)
        TObjectPtr<ULyraInventoryItemInstance> Instance = nullptr;

        // The rotation of the item if this cell is its root.
        UPROPERTY(BlueprintReadOnly, Category=Inventory)
        EItemRotation Rotation = EItemRotation::Rotation_0;

        // The Clump ID the changed cell belongs to.
        UPROPERTY(BlueprintReadOnly, Category=Inventory)
        int32 ClumpID = -1;

        // The coordinate (X, Y) of the changed cell within its clump.
        UPROPERTY(BlueprintReadOnly, Category=Inventory)
        FIntPoint Position = FIntPoint(-1);

        /**
         * The coordinate (X, Y) of the root cell this cell belongs to.
         * FIntPoint(-1) if this cell is empty OR if it is the root cell itself.
         */
        UPROPERTY(BlueprintReadOnly, Category=Inventory)
        FIntPoint RootSlot = FIntPoint(-1);
    };
    ```
* **Broadcast By:** `FGridCellInfoList::BroadcastGridInventoryChangedMessage`. This is called internally whenever `UpdateCellItemInstance` or `UpdateNonRootCells` modifies the state of a `FGridCellInfo` entry (e.g., placing an item, removing an item, changing `RootSlot` pointers for non-root cells).
* **Purpose:** To inform listeners (primarily UI) that a specific cell's representation needs updating. This could involve:
  * Displaying/clearing the item icon in the root cell.
  * Showing/hiding highlighting for non-root cells occupied by an item (using the `RootSlot` info).
  * Updating tooltips or other cell-specific information.
*   **UI Handling:** A grid UI widget would typically:

    1. Listen for this message using `RegisterListener`.
    2. In the handler function, check if `InventoryOwner` matches the displayed inventory.
    3. Use `ClumpID` and `Position` to identify the specific UI slot widget corresponding to the changed cell.
    4. Update that slot widget based on the `Instance`, `Rotation`, and `RootSlot` information in the payload. (e.g., set icon, set background tint based on `RootSlot` != -1, store item instance reference for tooltips).

    <img src=".gitbook/assets/image (178).png" alt="" width="563" title="">

### `TAG_Lyra_Inventory_Message_InventoryResized`

This message signals a more significant change: the entire layout or structure of the inventory grid has been altered.

* **Tag:** `Lyra.Inventory.Message.InventoryResized`
*   **Payload Struct:** `FLyraVerbMessage` (Uses a generic message struct, the key info is the Instigator)

    ```cpp
    // Using the base LyraVerbMessage for simplicity
    USTRUCT(BlueprintType)
    struct FLyraVerbMessage // : public FGameplayTagBlueprintStruct
    {
        GENERATED_BODY()

        // The UActorComponent (ULyraTetrisInventoryManagerComponent) that was resized.
        UPROPERTY(BlueprintReadWrite, Category = Gameplay)
        TObjectPtr<AActor> Instigator = nullptr; // Technically Actor, but cast to Component expected

        // Other fields unused for this specific message...
        UPROPERTY(BlueprintReadWrite, Category = Gameplay)
        TObjectPtr<AActor> Target = nullptr;
        // ... Verb, Magnitude ...
    };
    ```
* **Broadcast By:** `FGridCellInfoList::BroadcastResizeInventoryMessage`. This is called on clients by `PostReplicatedReceive` _only if_ `HasLayoutChanged` detects that the `InventoryLayout` used to build the current `GridCellIndexMap` is different from the newly replicated `InventoryLayout`. It's also called on the server at the end of a successful `ResizeInventory` call.
* **Purpose:** To inform UI and other systems that the fundamental grid structure (number of cells, accessible locations, overall dimensions) has changed and a full rebuild/refresh is required.
* **UI Handling:** A grid UI widget listening for this message should:
  1. Check if the `Instigator` (cast to `ULyraTetrisInventoryManagerComponent`) matches the displayed inventory.
  2. If it matches, completely clear its existing grid UI elements.
  3. Re-read the `InventoryLayout` and `GetAllGridCells` from the inventory component.
  4. Re-generate the entire visual grid based on the new layout and cell information.

<img src=".gitbook/assets/image (177).png" alt="" width="563" title="Example of tetris inventory listening for resizing">

### Other Potentially Relevant Messages

The gameplay messages broadcast from the parent Base Lyra Inventory class would still be broadcasted. Listen to those broadcasts to respond to important inventory events. Go to [this page](../../../base-lyra-modified/items/inventory-manager-component/broadcasted-gameplay-messages.md) to get more details on Base Lyra Inventory gameplay messages.

By listening for these grid-specific messages alongside the base inventory messages, your UI can stay accurately synchronized with the spatial state and structural changes of the `ULyraTetrisInventoryManagerComponent`.
