# Adding Access-Rights & Permissions to container

> **Goal:** add the “who-can-see / who-can-touch” layer to **any** inventory, equipment, or custom container class while keeping its original replication logic intact.

***

### C++ Permission Component Integration

Use these **four** code edits to bolt the permission system onto any container written in C++.

> [!info]
> **Note:** For experienced developers these four steps do not have to be followed exactly. This mainly serves as a useful guide for adding a replication capable UObject to a component.

#### **1. Header (`.h`)**

_Inside the class that owns items and requires an access rights and permissions (inventory, equipment, stash, crafting…)_

```cpp
#include "PermissionComponentHelpers.h"

// Make sure the interface is added "public IItemPermissionOwner"
class UMyComponent : public UActorComponent, public IItemPermissionOwner
{
	GENERATED_BODY()
	
public:
	virtual UItemPermissionComponent* GetPermissionComponent_Implementation() override
	{
		return PermissionComponent;
	}

	/* Instantiate on the *runtime* component, never on the CDO */
	virtual void InitializeComponent() override
	{
		Super::InitializeComponent();
		if (!PermissionComponent)
		{
			PermissionComponent = NewObject<UItemPermissionComponent>(
				this,
				UItemPermissionComponent::StaticClass(),
				TEXT("PermissionComponent"),
				RF_Transient
			);
		}
	}
public:
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Replicated, 
		Category="Permissions", meta=(AllowPrivateAccess="true"))								
	TObjectPtr<UItemPermissionComponent> PermissionComponent;		
…
};
```

* Add the interface `public IItemPermissionOwner`,  to the component class
* Add the `UPROPERTY` for the `PermissionComponent`
* Override `initializeComponent` so that the `PermissionComponent` is created at runtime
* Override `GetPermissionComponent` from the interface so the interface knows how to get the `PermissionComponent`

***

#### 2. Constructor (`.cpp`)

```cpp
UMyComponent::UMyComponent(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	// necessary so the component itself replicates
	SetIsReplicatedByDefault(true);
	/* necessary for the "InitializeComponents" to be called creating the
	* Creating and assigning the PermissionComponent to a variable.
	*/
	bWantsInitializeComponent = true
	// neccessary to allow ReplicateSubObjects to be called
	bReplicateUsingRegisteredSubObjectList = false;
}
```

* Set the component to replicate
* Make the component initialize
* Replicate the sub object list using the component

***

#### 2. `GetLifetimeReplicatedProps`&#x20;

```cpp
UMyComponent::GetLifetimeReplicatedProps(
	TArray< FLifetimeProperty >& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	
	// want the permission component pointer to replicate
	DOREPLIFETIME(ThisClass, PermissionComponent);
}
```

* This will allow the `PermissionComponent` variable to replicate to it's client

***

#### **3. `ReplicateSubobjects`**

```cpp
bool UMyComponent::ReplicateSubobjects(
        UActorChannel* Ch, FOutBunch* B, FReplicationFlags* F)
{
	// replicate any existing sub-objects first (items, runtime fragments, …)
	bool WroteSomething = Super::ReplicateSubobjects(Ch, B, F);

	// add the permission component
	WroteSomething |= (PermissionComponent && 
		Channel->ReplicateSubobject(PermissionComponent, *Bunch, *RepFlags));

	return WroteSomething;
}
```

* **Manual call** tells the channel to treat `PermissionComp` as a networked child object. This is necessary because the **PermissionComponent** is a **UObject**

> [!warning]
> Make sure the component’s `bReplicateUsingRegisteredSubObjectList` is **set to `false`**.\
> Or `ReplicateSubobject` will not be called.

***

### Why no Blueprint-only version?

`ReplicateSubobjects()` is **not exposed** to Blueprints, so a pure-BP container cannot add the permission component _and_ replicate it correctly.\
If you need Blueprint workflows, create a minimal C++ parent class that implements the four steps above, then derive your Blueprint container from it.

***

### Using the system at runtime – **always call the interface**

Never poke `PermissionComp` directly.\
Instead onteract through the functions defined on **IItemPermissionOwner**.

* **Encapsulation** – keeps the underlying storage private; future refactors won’t break callers.
* **Authority safety** – mutating functions are tagged `BlueprintAuthorityOnly`; they simply do nothing when called on a non-authoritative client.
* **Identical API** in C++ and Blueprints – write gameplay code once, use it everywhere.

With these three edits and the interface calls in place, your container now inherits the full Access-Rights & Permissions pipeline: server-side authority, fast-array replication, and gameplay-message notifications – all without touching its original item logic.

***

### What gets replicated?

| Data                                       | Rep path                                     | Sent to clients when…                           |
| ------------------------------------------ | -------------------------------------------- | ----------------------------------------------- |
| **DefaultAccessRight / DefaultPermission** | normal `UPROPERTY(ReplicatedUsing)`          | value changes on the server                     |
| **Per-player overrides**                   | Fast-Array inside `UItemPermissionComponent` | only the entry that changed                     |
| **The component itself**                   | your `ReplicateSubobjects` helper            | once on spawn + if a property inside it dirties |

When the array callbacks fire on the client the component broadcasts:

* `TAG_ItemPermission_Message_AccessChanged` → `FItemAccessRightsChangedMessage`
* `TAG_ItemPermission_Message_PermissionsChanged` → `FItemPermissionsChangedMessage`

Widgets and gameplay scripts subscribe to those tags to open/close or enable/disable UI – details in the _Replication & Client Notifications_ page.

***

### Quick checklist

* [ ] Include LyraItemPermissionComponen&#x74;**.h**
* [ ] Make sure the class _implements_ **IItemPermissionOwner**
* [ ] **override the IItemPermissionOwner interface function `GetPermissionComponent_Implementation()`** and return the PermissionComponent
* [ ] Ensure there is a `PermissionComponent` variable in the container
* [ ] Ensure that the `UObject` is instantiated and `PermissionOwner` is set at runtime, preferably before `BeginPlay`. In this guide, the object is initialized in `InitializeComponent`, which is a suitable place as it runs during runtime and not on the class default object (CDO).
* [ ] Set `SetIsReplicatedByDefault(true)` in constructor
* [ ] Set `bWantsInitializeComponent = true` in the constructor
* [ ] Set `bReplicateUsingRegisteredSubObjectList = false` in the constructor
* [ ] Make sure `PermissionComponent` is replicating in `GetLifetimeReplicatedProps`
* [ ] Replicate  `PermissionComponent` in **`ReplicateSubobjects`** functio&#x6E;**.**
* [ ] Use the **interface**, not the raw pointer to `PermissionComponent`

Follow these steps and your container is now fully governed by the Access-Rights & Permissions system while keeping all of its original item replication logic untouched.
