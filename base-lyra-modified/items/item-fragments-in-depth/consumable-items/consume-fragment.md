# Consume Fragment

### “What makes this item usable?”

When you drag a brand-new **Item Definition** into your project it is just data: e.g. name, icon, etc\
One of the ways of letting a player _do_ something with it while it's in inventory is attaching exactly one extra fragment:

```
ID_EnergyDrink
└─ Fragments
   ├─ InventoryFragment_Icon
   ├─ InventoryFragment_SetStats
   └─ **InventoryFragment_Consume**   ← you add this
```

The **Consume Fragment** is the switch that turns a plain object into a “use-item”:

* **points** to the Ability that performs the effect;
* **tells** the system how many units to deduct when consumed;
* **chooses** whether the player is locked in place, briefly paused, or free to spam other items.

<img src=".gitbook/assets/image (47).png" alt="" title="Consumable Fragment">

#### Adding the fragment step-by-step

1. **Open** the item definition asset (e.g. `ID_HealthPotion`).
2. In the _Fragments_ array press **`+`** ➜ choose **InventoryFragment_Consume**.
3. Fill the properties (see next section).
4. Press **Compile** then **Save**.
5. That’s it. The UI “Use” button in the Tetris Inventory already knows what to do.

***

### Property reference (and why it matters)

| Property                                                                    | What it means                                                                                                                                                                                                                                                                                                      | Typical choices                                                                                                                    |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Ability To Activate** \*(`TSubclassOf<ULyraGameplayAbility_FromConsume>`) | The Gameplay Ability that actually heals, throws, buffs…                                                                                                                                                                                                                                                           | `GA_Consume_Medkit`, `GA_Consume_FragGrenade`                                                                                      |
| **Amount To Consume** _(int32, default 1)_                                  | How many units (stack/charges) are removed when **ConsumeItem()** is called inside the ability.                                                                                                                                                                                                                    | 1 for most items, 10 for “ammo boxes”, etc.                                                                                        |
| **Finish Policy** _(enum)_                                                  | <p>How long other consumes are blocked:<br>• <strong>End Immediately</strong> – no block<br>• <strong>Wait for OnConsume</strong> – brief block until the ability calls <code>ConsumeItem()</code><br>• <strong>Block Until Ability Ends</strong> – full lock-in until ability finishes (montage, delay, etc.)</p> | <p>Food buff → <em>End Immediately</em><br>Grenade → <em>Wait for OnConsume</em><br>Medkit → <em>Block Until Ability Ends</em></p> |

***

### What happens at runtime

1. Player presses **Use**, through some UI, and sends a gameplay event to run a `GA_Consume` ability.
2. **GA_Consume** looks for _InventoryFragment_Consume_ on the target item.
3. It spawns the _Ability To Activate_ picked in the fragment.
4. The chosen **Finish Policy** tells GA_Consume when to end:
   * immediately,
   * after `ConsumeItem()` fires, or
   * after the ability fully ends.
5. Inside your effect ability you call **`ConsumeItem()`** exactly when the cost should be paid.
6. `OnConsumeItem` is called in the ability, which should be populated per consume ability.

No other system needs to know the details; the fragment carries everything.

<div class="collapse">
<p class="collapse-title">Example Medkit (channelled heal)</p>
<div class="collapse-content">

| Setting             | Value                        |
| ------------------- | ---------------------------- |
| Ability To Activate | `GA_Consume_MedkitHeal`      |
| Amount To Consume   | 1                            |
| Finish Policy       | **Block Until Ability Ends** |

`GA_Consume_MedkitHeal` plays a 3-second montage, then calls `ConsumeItem()`, then `EndAbility()`.\
During those 3 s the player cannot start another consume.

</div>
</div>

<div class="collapse">
<p class="collapse-title">Energy Drink (instant stamina buff)</p>
<div class="collapse-content">

| Setting             | Value                    |
| ------------------- | ------------------------ |
| Ability To Activate | `GA_Consume_EnergyDrink` |
| Amount To Consume   | 1                        |
| Finish Policy       | **End Immediately**      |

The effect ability applies a buff and calls `ConsumeItem()` in the same tick.\
The player can slam multiple drinks in rapid succession.

</div>
</div>

***

### Common mistakes & quick fixes

| Symptom                             | Cause                                                                                   | Fix                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Pressing **Use** does nothing       | Fragment missing or `Ability To Activate` unset                                         | Add fragment / pick ability class                                                  |
| Item never leaves inventory         | Effect ability forgot to call  `ConsumeItem()` or forgot to override `OnConsumeItem()`  | Call `ConsumeItem()` where you want stack deducted, and populate `OnConsumeItem()` |
| Player stuck, can’t use other items | Finish Policy set to _Block Until Ability Ends_ but ability never ends                  | Ensure ability calls `EndAbility()` (after montage, delay, etc.)                   |

***

The `UInventoryFragment_Consume` serves as the simple, static data link for consumable items. It points the generic "use" action towards the correct specific effect ability and defines the default cost associated with a successful use, enabling a data-driven approach to defining item consumption.
