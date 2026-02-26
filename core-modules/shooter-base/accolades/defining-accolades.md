# Defining Accolades

At the heart of the Shooter Base Accolade System lies a data-driven approach. Instead of hard-coding specific rewards into game logic, accolades like "Double Kill," "Assist," or "Headshot" are defined as distinct data entries. This allows for easy creation, modification, and balancing of player rewards directly within the Unreal Editor, often without needing to write or change C++ or Blueprint code.

### Concept: Accolades as Data

The system primarily relies on defining accolades within a **Data Table**. Each row in this table represents a unique type of accolade that can be triggered and displayed. This row contains all the necessary information for the system to handle the accolade, from its visual appearance and sound to its display duration and interaction with other accolades.

This data-driven design makes the system highly flexible. Adding a new accolade is as simple as adding a new row to the table and configuring its properties.

### `FAccoladeDefinitionRow`: The Accolade Blueprint

The core structure used within the Data Table is `FAccoladeDefinitionRow`. This struct holds all the configurable properties for a single accolade type:

**Property Breakdown:**

* **`DisplayName` (FText):** The primary text shown to the player for this accolade. Supports localization.
* **`Sound` (TSoftObjectPtr):** A soft object pointer to the sound asset to play when the accolade is triggered. Using a soft pointer ensures the sound asset is only loaded when needed.
* **`Icon` (TSoftObjectPtr):** A soft object pointer to the visual icon (Texture, Material, etc.) to display. Also loaded asynchronously.
* **`DisplayDuration` (float):** The time in seconds the accolade widget created from this definition will be visible before being automatically removed.
* **`LocationTag` (FGameplayTag):** Crucial for directing the accolade to the correct `UAccoladeHostWidget` instance in your UI. The host widget must have a matching `LocationName` tag to display accolades with this `LocationTag`.
* **`AccoladeTags` (FGameplayTagContainer):** Tags assigned _to_ this accolade. These are primarily used by the `CancelAccoladesWithTag` feature of _other_ accolades. You can use these for categorization (e.g., `Accolade.Category.Elimination`, `Accolade.Category.Objective`) if needed for custom logic, but their main built-in function is for cancellation identification.
* **`CancelAccoladesWithTag` (FGameplayTagContainer):** Defines the cancellation behavior. When an accolade with this definition is triggered, the system checks all currently displayed or pending accolades in the _same_ `UAccoladeHostWidget`. If any of those existing accolades have a tag in their `AccoladeTags` that matches _any_ tag listed here in `CancelAccoladesWithTag`, those existing accolades are immediately removed. This is perfect for ensuring a "Triple Kill" removes a pending "Double Kill".

### `UAccoladeDefinition` (Data Asset)

The codebase also includes a `UAccoladeDefinition` class derived from `UDataAsset`. While Data Assets are a valid way to store configuration data in Unreal Engine, the primary flow demonstrated in the provided code (`UAccoladeHostWidget::OnNotificationMessage` and `OnRegistryLoadCompleted`) utilizes the **Data Registry** to look up `FAccoladeDefinitionRow` structs from a Data Table.

Therefore, while `UAccoladeDefinition` exists, you should focus on using **Data Tables** populated with `FAccoladeDefinitionRow` for defining your accolades, as this aligns with the system's current implementation for triggering and displaying them via Gameplay Messages and the Data Registry.

### Data Registry Integration

The link between a triggered event (like a message with the tag `Accolade.DoubleKill`) and the actual data defining that accolade (`DisplayName`, `Icon`, etc.) is the **Data Registry Subsystem**.

*   **Registry ID:** The system expects the accolade Data Table to be registered under a specific ID: `Accolades`.

    ```cpp
    static FName NAME_AccoladeRegistryID("Accolades");
    ```
*   **Row Name (Gameplay Tag):** When an accolade notification is received by `UAccoladeHostWidget`, it takes the `PayloadTag` from the `FLyraNotificationMessage` (e.g., `Accolade.DoubleKill`) and converts its `TagName` (the part after the last dot, so `DoubleKill`) into the **Row Name** to look up in the `Accolades` Data Table via the Data Registry.

    ```cpp
    // From UAccoladeHostWidget::OnNotificationMessage
    FDataRegistryId ItemID(NAME_AccoladeRegistryID, Notification.PayloadTag.GetTagName());
    UDataRegistrySubsystem::Get()->AcquireItem(ItemID, ...);
    ```

**Setup Steps:**

1. **Create Gameplay Tags:** Define specific Gameplay Tags for each accolade type you want (e.g., `Accolade.DoubleKill`, `Accolade.Assist`, `Accolade.KillingSpree`). These tags will be used both as the `Verb` in the triggering `FLyraVerbMessage` and to identify the row in the Data Table. It's recommended to establish a clear hierarchy (e.g., `Accolade.Type.KillStreak.KillingSpree`).
2. **Create Data Table:**
   * In the Content Browser, right-click -> Miscellaneous -> Data Table.
   * Choose `FAccoladeDefinitionRow` as the Row Structure.
   * Name your Data Table (e.g., `DT_Accolades`).
3. **Populate Data Table:**
   * Open the `DT_Accolades` Data Table.
   * For each accolade:
     * Click "Add" to create a new row.
     * Set the **Row Name** to match the final part of the corresponding Gameplay Tag (e.g., for `Accolade.DoubleKill`, the Row Name is `DoubleKill`). **This is crucial for the lookup to work!**
     * Fill in the `DisplayName`, `Sound`, `Icon`, `DisplayDuration`, `LocationTag`, `AccoladeTags`, and `CancelAccoladesWithTag` properties for that accolade.
4. **Register Data Table:**
   * Go to Project Settings -> Game -> Data Registry.
   * Add an entry to the "Registered Data Registries".
   * Set the "Registry Type" ID to `Accolades`.
   * Add your `DT_Accolades` Data Table asset to the "Data Tables" list for this registry type.

### Best Practices

* **Consistent Tag Naming:** Use a clear and consistent naming convention for your Accolade Gameplay Tags. This makes managing them and identifying rows easier.
* **Use `LocationTag` Wisely:** Define distinct `LocationTag` values (e.g., `HUD.Accolade.Center`, `HUD.Accolade.Feed`) if you want different types of accolades to appear in different screen locations using separate `UAccoladeHostWidget` instances.
* **Leverage `CancelAccoladesWithTag`:** For hierarchical accolades (Single -> Double -> Triple Kill, or different tiers of streaks), use the cancellation tags effectively.
  * Give lower-tier accolades identifying tags in `AccoladeTags` (e.g., `Accolade.Type.MultiKill.Double`).
  * Make higher-tier accolades list those tags in their `CancelAccoladesWithTag` field.
* **Optimize Assets:** Keep sounds short and impactful. Ensure icons are appropriately sized and optimized for UI usage. Use soft pointers (`TSoftObjectPtr`) in the Data Table as shown – the system relies on this for async loading.
* **Test Thoroughly:** After defining accolades, test their triggers, display, timing, sound, icons, location, and cancellation behavior in-game.

By defining accolades in data tables and linking them via the Data Registry and Gameplay Tags, you create a powerful and designer-friendly system for providing compelling player feedback. The next sections will cover how these definitions are used by the server-side processors and client-side UI.

***
