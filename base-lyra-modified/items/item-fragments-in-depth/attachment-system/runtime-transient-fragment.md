# Runtime Transient Fragment

While `UInventoryFragment_Attachment` defines the static rules and potential behaviors, the `UTransientRuntimeFragment_Attachment` is the **runtime UObject** created on an `ULyraInventoryItemInstance` that actually **manages the currently attached items** and **applies their defined behaviors** based on the host item's state.

### Creation and Purpose

* **Automatic Creation:** An instance of `UTransientRuntimeFragment_Attachment` is automatically created and added to the `RuntimeFragments` array of an `ULyraInventoryItemInstance` whenever its `ItemDef` contains the static `UInventoryFragment_Attachment`. This happens during `UInventoryFragment_Attachment::CreateNewRuntimeTransientFragment`.
* **Instance-Specific:** Each item instance capable of hosting attachments gets its _own_ `UTransientRuntimeFragment_Attachment`.
* **Core Responsibilities:**
  * Stores the list of currently attached item instances (`AttachmentArray`).
  * Tracks the state of the host item (Equipped/Held vs. Holstered).
  * Activates/Deactivates attachment behaviors (spawning actors, granting abilities, applying input) based on host state and the `FAttachmentDetails` configured in the static fragment.
  * Handles replication of the attachment list and attached item instances.
  * Propagates state changes and context to nested attachments.

### Storing Live Attachments: `AttachmentArray`

* **Type:** `FAppliedAttachmentArray` (A struct deriving from `FFastArraySerializer`).
* **Contents:** Holds a `TArray<FAppliedAttachmentEntry>`.
* **`FAppliedAttachmentEntry`:** Represents one attached item and stores:
  * `AttachmentSlot` (`FGameplayTag`): The slot this attachment occupies on its direct parent.
  * `ItemDefinition` (`TSubclassOf<ULyraInventoryItemDefinition>`): The definition of the attached item.
  * `ItemInstance` (`TObjectPtr<ULyraInventoryItemInstance>`): A pointer to the actual instance of the attached item.
  * `AttachmentDetails` (`FAttachmentDetails`): A _copy_ of the behavior details retrieved from the parent's `CompatibleAttachments` map when this attachment was added. Storing it here ensures the runtime fragment has the correct behavior information readily available.
  * `GrantedHandles` (`FLyraAbilitySet_GrantedHandles`, Not Replicated): Tracks GAS handles for abilities granted by this specific attachment.
  * `BindHandles` (`TArray<uint32>`, Not Replicated): Tracks handles for input actions/mappings added by this attachment.
  * `SpawnedActor` (`TObjectPtr<AActor>`, Not Replicated): A pointer to the visual actor spawned for this attachment based on the current host state (Held/Holstered).
* **Replication:** `AttachmentArray` uses Fast Array Serialization. Changes (attachments added/removed) are replicated efficiently. Client-side callbacks (`PreReplicatedRemove`, `PostReplicatedAdd`, etc.) trigger `UInventoryFragment_Attachment::BroadcastAttachmentSlotChanged` to notify UI and other systems.

### Managing State & Applying Behavior

The runtime fragment constantly monitors the state of its owning host item instance and applies attachment effects accordingly.

**State Tracking:**

* `bIsEquipped` (`bool`, ReplicatedUsing=OnRep_IsEquipped): True if the host item is currently **Held**. Set via the `OnEquipped`/`OnUnequipped` lifecycle callbacks.
* `bIsHolstered` (`bool`, ReplicatedUsing=OnRep_IsHolstered): True if the host item is currently **Holstered**. Set via the `OnHolster`/`OnUnholster` lifecycle callbacks.
* `AttachActor` (`TObjectPtr<AActor>`): A pointer to the primary visual actor of the _host_ item (obtained from the `ULyraEquipmentInstance`'s `SpawnedActors`). Attachments' visual actors are attached _to this_.
* `OwningActor` (`TObjectPtr<AActor>`): Typically the Controller possessing the Pawn that equipped the host item. Needed for granting abilities via GAS.
* `EquipmentInstance` (`TObjectPtr<ULyraEquipmentInstance>`): Pointer to the host item's equipment instance when equipped/holstered.

**Activation/Deactivation Logic:**

* `ActivateAttachment(FAppliedAttachmentEntry& Attachment, ...)`: Called when an attachment is added _while_ the host is already Equipped/Holstered, OR when the host _transitions_ to the Equipped/Holstered state.
  * Determines whether to use `HeldAttachmentSettings` or `HolsteredAttachmentSettings` from `Attachment.AttachmentDetails` based on `bIsEquipped`/`bIsHolstered`.
  * Calls helper functions: `SpawnAttachmentActor`, `GrantAbilities`, `AddInputContextMapping`.
  * Recursively calls `ActivateAttachment` on any nested attachments within `Attachment.ItemInstance`.
* `DeactivateAttachment(FAppliedAttachmentEntry& Attachment)`: Called when an attachment is removed, OR when the host item transitions _out_ of the Equipped/Holstered state.
  * Calls helper functions: `RemoveAttachmentActors`, `RemoveAbilities`, `RemoveInputContextMapping`.
  * Recursively calls `DeactivateAttachment` on any nested attachments.

**Helper Functions (Internal Logic):**

* `SpawnAttachmentActor`: Reads the `ActorSpawnInfo` from the relevant (Held/Holstered) `FAttachmentBehaviour`, spawns the actor using the world context, attaches it to the `AttachActor` (the host's mesh) at the specified socket/transform, and stores the pointer in `Attachment.SpawnedActor`.
* `RemoveAttachmentActors`: Destroys the actor stored in `Attachment.SpawnedActor`.
* `GrantAbilities`: Reads `AbilitySetsToGrant`, gets the ASC from `OwningActor`, and calls `AbilitySet->GiveToAbilitySystemWithTag`, passing the `Attachment.GrantedHandles`, the _parent_ item instance (`SourceObject`), and the `Attachment.AttachmentSlot` (as a dynamic source tag).
* `RemoveAbilities`: Calls `Attachment.GrantedHandles.TakeFromAbilitySystem`.
* `AddInputContextMapping`/`RemoveInputContextMapping`: Interacts with `ULyraHeroComponent` and `UEnhancedInputLocalPlayerSubsystem` to add/remove Input Mapping Contexts and Input Configs defined in the `FAttachmentBehaviour`.

**Replication Callbacks (`OnRep_IsEquipped`, `OnRep_IsHolstered`):**

* These functions are called on clients when the replicated `bIsEquipped` or `bIsHolstered` state changes.
* They iterate through the `AttachmentArray` and call `ActivateAttachment` or `DeactivateAttachment` on each entry, ensuring client-side visuals, abilities (if relevant locally), and input contexts match the authoritative server state.

### Adding & Removing Attachments Runtime

* `AddAttachment(FAppliedAttachmentEntry& Attachment, ...)`: Adds the entry to the `AttachmentArray`. If the host is already active (`bIsEquipped`/`bIsHolstered`), calls `ActivateAttachment`. Marks the array dirty for replication.
* `RemoveAttachment(const FGameplayTag& AttachmentSlot)`: Finds the entry by slot tag, calls `DeactivateAttachment` if the host is active, removes the entry from `AttachmentArray`, marks the array dirty, and returns the removed `ULyraInventoryItemInstance*`.

These functions are typically called internally by the static `UInventoryFragment_Attachment::AddAttachmentToItemInstance` and `RemoveAttachmentFromItemInstance` API functions, which provide higher-level checks and integration.

### Handling Nested Attachments

The system supports nesting:

* When `ActivateAttachment` is called on an attachment (`Attachment A`), it checks if `Attachment A`'s item instance also has a `UTransientRuntimeFragment_Attachment`.
* If it does, it recursively calls `ActivateAttachment` on _all_ attachments (`Attachment B`) listed in `Attachment A`'s runtime fragment. `Attachment B`'s actor will be attached to `Attachment A`'s spawned actor (`AttachActor` on `Attachment A`'s runtime fragment is set during its own `SpawnAttachmentActor` call).
* Abilities granted by `Attachment B` should have `Attachment A`'s item instance as their `SourceObject`.
* Deactivation follows the same recursive pattern.

### Replication of Attached Items

* The `UTransientRuntimeFragment_Attachment` overrides `ReplicateSubobjects`.
* Inside this function, it iterates through its `AttachmentArray.Attachments`.
* For each valid `Entry.ItemInstance`, it calls `Channel->ReplicateSubobject(...)` on the instance.
* It also recursively replicates any `RuntimeFragments` belonging to the attached item instance, ensuring their state is also synchronized.
* This requires the component owning the _host_ item instance (e.g., `ULyraInventoryManagerComponent`) to correctly call `ReplicateSubobjects` on the host item's runtime fragments, thereby triggering the nested replication.

***

The `UTransientRuntimeFragment_Attachment` is the dynamic engine that brings the static attachment definitions to life. It manages the live state of attached items, applies their behaviors conditionally based on the host's equipped/holstered status, handles replication, and supports complex nesting structures. Its interaction with the static fragment definitions and the core lifecycle events makes the attachment system robust and functional.
