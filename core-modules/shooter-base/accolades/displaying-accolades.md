# Displaying Accolades

Once an accolade has been detected, processed, and relayed to the correct client, the final step is presenting it visually to the player. This crucial client-side responsibility falls upon the **`UAccoladeHostWidget`**. This UMG widget acts as the manager and display container for accolades appearing in a specific region of the player's HUD.

### Introduction: The Client-Side Manager

`UAccoladeHostWidget` is a specialized `UCommonUserWidget` designed to:

1. Listen for targeted accolade notification messages.
2. Verify the notification is intended for the owning player and the correct UI location.
3. Look up the accolade's definition data (text, icon, sound).
4. Asynchronously load the required assets (icon, sound) to prevent UI hitches.
5. Manage a queue to display accolades sequentially if multiple arrive quickly.
6. Handle cancellation logic (e.g., a Triple Kill removing a Double Kill).
7. Interface with Blueprint to allow designers to create the actual visual appearance and destruction animations for the accolade widgets.

You typically place one or more instances of `UAccoladeHostWidget` (or a Blueprint subclass of it) into your main HUD layout, configuring each instance to handle accolades designated for a specific screen location.

### Listening for Notifications

The widget begins listening for accolade notifications as soon as it's constructed:

```cpp
// From UAccoladeHostWidget::NativeConstruct
UGameplayMessageSubsystem& MessageSubsystem = UGameplayMessageSubsystem::Get(this);
ListenerHandle = MessageSubsystem.RegisterListener(TAG_Lyra_AddNotification_Message, this, &ThisClass::OnNotificationMessage);

// From UAccoladeHostWidget::NativeDestruct
UGameplayMessageSubsystem& MessageSubsystem = UGameplayMessageSubsystem::Get(this);
MessageSubsystem.UnregisterListener(ListenerHandle);
CancelAsyncLoading(); // Clean up any pending asset loads
```

* It subscribes specifically to the `Lyra.AddNotification.Message` channel, which is the channel the `UAccoladeRelay` uses to broadcast targeted UI notifications.
* In `NativeDestruct`, it cleans up the listener and cancels any ongoing asynchronous asset loads using the `FAsyncMixin` functionality.

### Filtering Notifications (`OnNotificationMessage`)

When any message arrives on the `Lyra.AddNotification.Message` channel, the `OnNotificationMessage` function performs initial filtering:

```cpp
void UAccoladeHostWidget::OnNotificationMessage(FGameplayTag Channel, const FLyraNotificationMessage& Notification)
{
    // 1. Check if the notification is actually for Accolades
    if (Notification.TargetChannel == TAG_Lyra_ShooterGame_Accolade) // "ShooterGame.Accolade"
    {
        // 2. Check if the notification is targeted at THIS player
        if (Notification.TargetPlayer != nullptr)
        {
            APlayerController* PC = GetOwningPlayer();
            if ((PC == nullptr) || (PC->PlayerState != Notification.TargetPlayer))
            {
                return; // Ignore if not for me
            }
        }

        // 3. Initiate Data Loading (Location filtering happens later)
        const int32 NextID = AllocatedSequenceID++; // Assign unique ID for async tracking
        FDataRegistryId ItemID(NAME_AccoladeRegistryID, Notification.PayloadTag.GetTagName());
        if (!UDataRegistrySubsystem::Get()->AcquireItem(ItemID, FDataRegistryItemAcquiredCallback::CreateUObject(this, &ThisClass::OnRegistryLoadCompleted, NextID)))
        {
            // Log error if definition not found
            AllocatedSequenceID--; // Roll back ID on failure
        }
    }
}
```

1. **Channel Check:** Verifies the notification's `TargetChannel` is `ShooterGame.Accolade`.
2. **Player Check:** Ensures the `TargetPlayer` specified in the notification matches the `PlayerState` associated with this widget instance's owning player controller. This prevents players from seeing accolades meant for others.
3. **Initiate Data Loading:** If the checks pass, it proceeds to request the `FAccoladeDefinitionRow` from the Data Registry using the `PayloadTag` (e.g., `Accolade.DoubleKill`) from the notification. _Note: Filtering based on the widget's `LocationName` versus the definition's `LocationTag` happens after the data is loaded._

### Data Acquisition & Asynchronous Loading

Loading data and assets synchronously can cause noticeable hitches in the game. `UAccoladeHostWidget` uses asynchronous operations extensively:

1. **Data Registry Acquisition:** `UDataRegistrySubsystem::AcquireItem` is called. This is itself potentially asynchronous, hence the callback mechanism (`OnRegistryLoadCompleted`).
2. **`OnRegistryLoadCompleted` Callback:** Triggered when the Data Registry lookup finishes.
   * Retrieves the `FAccoladeDefinitionRow`.
   * Creates a `FPendingAccoladeEntry` struct to hold the row data and track loading state. Assigns the `SequenceID` received from the initial call.
   * Adds the `Sound` and `Icon` soft object paths from the row to a temporary list.
   * Calls `AsyncLoad` (provided by `FAsyncMixin`) with the list of assets and a lambda callback.
   * Calls `StartAsyncLoading` (also from `FAsyncMixin`) to begin the background asset loading.
3. **`AsyncLoad` Lambda Callback:** Triggered when the `Sound` and `Icon` assets have finished loading in the background.
   * Finds the corresponding `FPendingAccoladeEntry` in the `PendingAccoladeLoads` array using the captured `SequenceID`.
   * Assigns the loaded `Sound` and `Icon` objects (using `.Get()`) to the entry.
   * Sets `EntryThatFinishedLoading->bFinishedLoading = true`.
   * Calls `ConsiderLoadedAccolades()` to attempt processing now that assets are ready.

### Handling Asynchronous Order (Sequencing)

Because Data Registry lookups and asset loading are asynchronous, notifications might finish processing in a different order than they were received. The system uses a sequence ID mechanism to ensure accolades are processed and potentially displayed in the order they were triggered:

* **`AllocatedSequenceID`:** Incremented each time a valid notification begins processing. Passed to `OnRegistryLoadCompleted` and stored in `FPendingAccoladeEntry`.
* **`NextDisplaySequenceID`:** Tracks the sequence ID of the _next_ accolade that _should_ be processed.
* **`PendingAccoladeLoads`:** A `TArray<FPendingAccoladeEntry>` holding accolades whose data row has been retrieved but whose assets might still be loading.
* **`ConsiderLoadedAccolades()`:** This function runs whenever an entry finishes loading assets. It loops, looking for the entry in `PendingAccoladeLoads` that both has `bFinishedLoading == true` AND whose `SequenceID` matches the `NextDisplaySequenceID`.
  * If found, it removes the entry from `PendingAccoladeLoads`, calls `ProcessLoadedAccolade` with it, and increments `NextDisplaySequenceID`.
  * It continues looping in case the _next_ entry in sequence had also finished loading while the previous one was being processed.

This ensures that even if `Accolade #3` finishes loading assets before `Accolade #2`, `Accolade #2` will still be processed first once its assets are ready.

### Processing Loaded Accolades (`ProcessLoadedAccolade`)

Once an accolade entry has its data and assets loaded and is the next in sequence, `ProcessLoadedAccolade` handles the final filtering and cancellation logic:

```cpp
void UAccoladeHostWidget::ProcessLoadedAccolade(const FPendingAccoladeEntry& Entry)
{
    // 1. Location Filtering
    if (Entry.Row.LocationTag == LocationName) // Compare definition Tag with widget Tag
    {
        bool bRecreateWidget = PendingAccoladeDisplays.Num() == 0; // Need to display immediately if queue empty

        // 2. Cancellation Logic
        for (int32 Index = 0; Index < PendingAccoladeDisplays.Num(); )
        {
            // Does the EXISTING entry have a tag that the NEW entry wants to cancel?
            if (PendingAccoladeDisplays[Index].Row.AccoladeTags.HasAny(Entry.Row.CancelAccoladesWithTag))
            {
                if (UUserWidget* OldWidget = PendingAccoladeDisplays[Index].AllocatedWidget)
                {
                    // Destroy the visual widget being cancelled
                    DestroyAccoladeWidget(OldWidget);
                    bRecreateWidget = true; // Need to recreate if we cancelled the currently visible one
                }
                PendingAccoladeDisplays.RemoveAt(Index); // Remove cancelled entry from queue
            }
            else
            {
                ++Index; // Move to next existing entry
            }
        }

        // 3. Add to Display Queue
        PendingAccoladeDisplays.Add(Entry);

        // 4. Trigger Display if needed
        if (bRecreateWidget) // If queue was empty OR the visible item was cancelled
        {
            DisplayNextAccolade();
        }
    }
    // Else: Mismatched LocationTag, discard the accolade silently.
}
```

1. **Location Filtering:** Compares the `LocationTag` from the `FAccoladeDefinitionRow` with the `LocationName` tag configured on _this instance_ of the `UAccoladeHostWidget`. If they don't match, the accolade is ignored by this host widget instance.
2. **Cancellation Logic:** Iterates through the `PendingAccoladeDisplays` queue. For each existing accolade in the queue, it checks if any of its `AccoladeTags` are present in the _new_ incoming entry's `CancelAccoladesWithTag` list. If a match is found, the existing accolade is cancelled: its visual widget is destroyed via `DestroyAccoladeWidget`, and it's removed from the queue.
3. **Add to Queue:** The new, processed `Entry` is added to the end of the `PendingAccoladeDisplays` queue.
4. **Trigger Display:** If the queue was empty before adding this entry, or if the currently displayed item was cancelled, `DisplayNextAccolade` is called immediately to show the new accolade (which is now at the front of the queue).

### Display Queue Management

The system displays accolades one at a time using the `PendingAccoladeDisplays` queue and a timer:

* **`PendingAccoladeDisplays`:** A `TArray<FPendingAccoladeEntry>` acts as the FIFO queue. The accolade at index `0` is the one currently (or about to be) displayed.
* **`DisplayNextAccolade()`:**
  * Checks if the queue is not empty.
  * Takes the entry at index `0`.
  * Calls the Blueprint event `CreateAccoladeWidget(Entry)`.
  * Stores the widget returned by Blueprint in `Entry.AllocatedWidget`.
  * Starts a timer (`NextTimeToReconsiderHandle`) for `Entry.Row.DisplayDuration` seconds, which will call `PopDisplayedAccolade`.
* **`PopDisplayedAccolade()`:**
  * Called when the display timer for the current accolade expires.
  * Checks if the queue is not empty.
  * Calls the Blueprint event `DestroyAccoladeWidget(PendingAccoladeDisplays[0].AllocatedWidget)` to remove the visual element.
  * Removes the entry from the front of the queue (`PendingAccoladeDisplays.RemoveAt(0)`).
  * Calls `DisplayNextAccolade()` again to immediately start the display process for the next item in the queue, if any.

### Blueprint Integration

The power to customize the _visuals_ lies in Blueprint subclasses of `UAccoladeHostWidget`. You override two key `BlueprintImplementableEvent` functions:

1. **`CreateAccoladeWidget(const FPendingAccoladeEntry& Entry)`:**
   * **Input:** Receives the `FPendingAccoladeEntry` containing the loaded data (`Row.DisplayName`, `Icon`, `Sound`, etc.).
   * **Action:** Implement this in your UMG Blueprint. Create your custom accolade widget instance (which might contain Text Blocks, Images, animations). Populate it using the data from the `Entry`. Play the `Entry.Sound` if desired. Add the created widget as a child to the host widget (or wherever appropriate in your layout). Trigger any entry animations.
   * **Output:** Return the newly created `UUserWidget*`. The C++ code stores this pointer to manage the widget's lifetime.
2. **`DestroyAccoladeWidget(UUserWidget* Widget)`:**
   * **Input:** Receives the `UUserWidget*` that was previously created by `CreateAccoladeWidget`.
   * **Action:** Implement this in your UMG Blueprint. Handle the visual removal of the widget. This is the ideal place to play fade-out or other exit animations _before_ actually removing the widget from its parent or marking it for garbage collection.

### Configuration

The primary configuration for an instance of `UAccoladeHostWidget` placed in your UI is:

* **`LocationName` (FGameplayTag):** Set this tag in the UMG editor details panel for each instance. This tag **must** match the `LocationTag` set in the `FAccoladeDefinitionRow` for any accolades you want _this specific instance_ of the host widget to display. For example, one instance might have `LocationName = "HUD.Accolade.CenterScreen"` while another has `LocationName = "HUD.Accolade.Feed"`.

By combining robust C++ logic for handling notifications, data loading, sequencing, and queueing with flexible Blueprint events for visual implementation, the `UAccoladeHostWidget` provides a powerful and customizable system for displaying player achievements.

***
