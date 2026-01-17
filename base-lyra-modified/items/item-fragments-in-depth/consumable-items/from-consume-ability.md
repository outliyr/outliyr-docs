# From Consume Ability

`ULyraGameplayAbility_FromConsume` is the base class for all consumable item effects. You subclass it (in Blueprint or C++) to define what happens when a player uses an item.

| Item Type     | Example Ability           |
| ------------- | ------------------------- |
| Health Potion | `GA_Consume_HealthPotion` |
| Grenade       | `GA_Consume_ThrowGrenade` |
| Energy Drink  | `GA_Consume_EnergyBuff`   |
| Med-Kit       | `GA_Consume_MedkitHeal`   |

***

### Your Responsibilities

{% stepper %}
{% step %}
#### Implement the effect

What does the item do? (heal, spawn, buff, etc.)
{% endstep %}

{% step %}
#### Call `ConsumeItem()`

When should the item be consumed?
{% endstep %}

{% step %}
#### Call `EndAbility()`

When is the effect complete?
{% endstep %}
{% endstepper %}

That's it. The system handles everything else (granting, networking, cleanup, item removal).

***

### Basic Structure

{% stepper %}
{% step %}
Event ActivateAbility

* \[Optional] Check conditions (CanConsumeItem already ran)
{% endstep %}

{% step %}
Do your effect

* Apply Gameplay Effect
* Play montage
* Spawn actor
* etc.
{% endstep %}

{% step %}
Call `ConsumeItem()` ← deducts item, fires callbacks
{% endstep %}

{% step %}
Call `EndAbility()` ← required to finish
{% endstep %}
{% endstepper %}

***

## Key Functions

### `ConsumeItem()`

Call this when the item cost should be applied.

```cpp
UFUNCTION(BlueprintCallable, Category = "Lyra|Consume")
void ConsumeItem();
```

What it does:

* Decrements stack count by `AmountToConsume` (from the fragment)
* Automatically removes the item if stack reaches 0
* Fires `PlayConsumeEffects()` for VFX/sounds
* Sends transaction to server for validation
* Fires `OnConsumeSucceeded` or `OnConsumeFailed` after server responds

> [!INFO]
> Item removal is automatic. You don't need to manually remove items from inventory - `ConsumeItem()` handles everything.

### `PlayConsumeEffects(Item, Quantity)`

Override this Blueprint event to play visual/audio effects when consuming.

```cpp
UFUNCTION(BlueprintImplementableEvent, Category = "Lyra|Consume")
void PlayConsumeEffects(ULyraInventoryItemInstance* ItemInstance, int32 Quantity);
```

This fires **immediately** when `ConsumeItem()` is called - before server confirmation. Use it for:

* Sound effects
* Particle effects
* UI feedback
* Animations that should feel responsive

### `OnConsumeSucceeded`

Delegate that fires when the server confirms the consume transaction succeeded.

```cpp
UPROPERTY(BlueprintAssignable, Category="Lyra|Consume")
FOnConsumeSucceeded OnConsumeSucceeded;
```

Bind to this if you need to do something only after server confirmation.

### `OnConsumeFailed(FailReason)`

Delegate that fires when the consume transaction fails.

```cpp
UPROPERTY(BlueprintAssignable, Category="Lyra|Consume")
FOnConsumeFailed OnConsumeFailed;
```

The `FailReason` tells you why (validation failed, server rejected, etc.). Use this to:

* Show error feedback to player
* Revert any optimistic UI changes
* Log for debugging

### `GetConsumableItemInstance()`

Returns the item being consumed.

```cpp
UFUNCTION(BlueprintCallable, Category = "Lyra|Consume")
ULyraInventoryItemInstance* GetConsumableItemInstance() const;
```

Use this to access the item's data, stats, or other fragments.

### `CanConsumeItem(Item)`

Override this to add custom validation before the ability activates.

```cpp
UFUNCTION(BlueprintNativeEvent, Category = "Lyra|Consume")
bool CanConsumeItem(const ULyraInventoryItemInstance* ItemInstance) const;
```

Return `false` to cancel the ability. Examples:

* Health potion when already at full health
* Item requires a specific game state
* Cooldown hasn't expired

***

### Common Patterns

{% stepper %}
{% step %}
#### Instant Effect

```
ActivateAbility
  → Apply Gameplay Effect to Owner
  → ConsumeItem()
  → EndAbility()
```

Finish Policy: `EndImmediately`
{% endstep %}

{% step %}
#### Channeled Effect (with Montage)

```
ActivateAbility
  → Play Montage and Wait
  → On Completed:
      → Apply Gameplay Effect
      → ConsumeItem()
      → EndAbility()
  → On Interrupted:
      → EndAbility() (no consume)
```

Finish Policy: `BlockOtherConsumes`
{% endstep %}

{% step %}
#### Throwable (Spawn Actor)

```
ActivateAbility
  → Play Throw Animation
  → Spawn Projectile Actor
  → ConsumeItem()
  → EndAbility()
```

Finish Policy: `WaitForConsumeEffect`
{% endstep %}

{% step %}
### Conditional Effect

```
ActivateAbility
  → Check if effect can apply (e.g., not at full health)
  → If valid:
      → Apply Effect
      → ConsumeItem()
  → EndAbility()
```
{% endstep %}
{% endstepper %}

***

### Debugging

| Symptom                       | Likely Cause                                 | Fix                                       |
| ----------------------------- | -------------------------------------------- | ----------------------------------------- |
| Item not removed              | `ConsumeItem()` never called                 | Add `ConsumeItem()` call                  |
| Ability never ends            | `EndAbility()` never called                  | Ensure all code paths call `EndAbility()` |
| Ability doesn't activate      | `CanConsumeItem()` returned false            | Check your validation logic               |
| Effect happens but item stays | Called `EndAbility()` before `ConsumeItem()` | Reorder the calls                         |
| Consume fails silently        | Server rejected transaction                  | Bind to `OnConsumeFailed` to see reason   |

***
