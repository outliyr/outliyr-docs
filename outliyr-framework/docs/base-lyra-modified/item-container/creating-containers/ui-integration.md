# UI Integration

Once your container implements `ILyraItemContainerInterface`, it can integrate with the UI system. This page provides a brief orientation for full implementation details, see the [**Item Container UI**](../../ui/item-container-ui-system/) documentation section.

***

### The Connection Point

The UI system interacts with containers through the interface you've already implemented:

* **`ForEachItem`** - UI uses this to populate item displays
* **`GetItemInSlot`** - UI uses this to query specific slots
* **`CanAcceptItem`** - UI uses this for drop validation and visual feedback

If your interface methods work correctly, the UI layer can display your container's contents.

***

### What the UI Needs from Your Container

#### Slot Descriptors

Your slot descriptor struct (the one inheriting from `FAbilityData_SourceItem`) must:

{% stepper %}
{% step %}
**Resolve back to your container**

Ensure the descriptor can resolve to the container via `ResolveContainer()`.
{% endstep %}

{% step %}
**Hash and compare correctly**

Provide correct hashing and comparison logic so slots can be identified uniquely.
{% endstep %}

{% step %}
**Serialize properly**

If the descriptors are used in transactions, they must serialize correctly.
{% endstep %}
{% endstepper %}

The UI passes these slot descriptors around to identify where items are and where they can go.

#### Change Notifications

For the UI to stay synchronized, your container should notify when its contents change:

{% hint style="info" %}
* Server-authoritative containers: Broadcast after replication updates
* Predicted containers: The prediction runtime handles this via `OnViewDirtied()`
{% endhint %}

Without change notifications, the UI won't know to refresh.

***

### Where to Learn More

The [**Item Container UI**](../../ui/item-container-ui-system/) documentation section covers:

* How the UI discovers and binds to containers
* View model architecture and customization
* Widget implementation patterns
* Drag and drop integration
* Handling predicted vs confirmed state in the UI

***
