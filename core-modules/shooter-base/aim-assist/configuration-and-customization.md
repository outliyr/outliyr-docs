# Configuration & Customization

Understanding how the Aim Assist system works internally is one part of the equation; the other is knowing how to configure it to perfectly suit your game's needs. This page details the various ways you can set up, tune, and extend the Aim Assist system.

***

### Setting Up the Aim Assist Input Modifier

The `UAimAssistInputModifier` is the primary interface for integrating aim assist into your player's input. Here’s how you set it up:

1. **Add to Input Mapping Context (IMC):**
   * Open the Input Mapping Context asset that handles your player's look controls (e.g., `IMC_Default_KBM` or `IMC_Default_Gamepad` in Lyra).
   * Find the `UInputModifier` array for your look `UInputAction` (e.g., "Look_Mouse" or "Look_GamepadStick").
   * Add a new element to this array and select `UAimAssistInputModifier` from the dropdown.
   * **Important:** The order of modifiers matters. Aim Assist should generally be one of the last modifiers if you have others that might, for example, apply dead zones or sensitivity curves _before_ aim assist is calculated.
2. **Configure Modifier Properties:**\
   Once added, select the `UAimAssistInputModifier` instance in the IMC to access its properties:
   * **`Settings (FAimAssistSettings)`:** This is the main struct where you'll define most of the aim assist behavior. We'll detail this extensively in the next section.
   * **`Filter (FAimAssistFilter)`:** This struct controls which actors are considered valid targets. Detailed below.
   * **`Move Input Action (MoveInputAction)`:**
     * Assign the `UInputAction` asset that corresponds to your player's movement input (e.g., the action for gamepad left stick movement).
     * This is used if `FAimAssistSettings::bApplyStrafePullScale` is enabled, allowing the system to scale aim assist pull based on player strafing when not actively looking.
   * **`Targeting Type (ELyraTargetingType)`:**
     * Determines the context for applying settings, primarily for differentiating between hip-fire and Aim Down Sights (ADS) behavior.
     * Set to `Normal` for general hip-fire aim assist.
     * Set to `ADS` for aim assist active while aiming down sights.
     * You will typically have _two separate instances_ of `UAimAssistInputModifier` on your look input action if you want different behaviors for hip-fire and ADS – one configured for `Normal` and one for `ADS`. You would then use gameplay logic (e.g., when the player presses the ADS button) to enable/disable these modifiers on the `UEnhancedInputLocalPlayerSubsystem` or by changing their mappings in the IMC.
   * **`Sensitivity Level Table (ULyraAimSensitivityData)`:**
     * Assign your `ULyraAimSensitivityData` asset here. This asset maps sensitivity presets (e.g., "Low," "Medium," "High" chosen by the player in settings) to scalar values.
     * The Aim Assist system uses this to scale its strength based on the player's chosen sensitivity, ensuring a more consistent feel across different sensitivity levels. The `TargetingType` (Normal/ADS) is used to fetch the appropriate sensitivity scalar (hip or targeting) from the player's shared settings.

***

### Fine-Tuning Behavior: `FAimAssistSettings`

The `FAimAssistSettings` struct, configured on each `UAimAssistInputModifier` instance, is where you'll spend most of your time tuning the feel of the aim assist.

* **Where to Configure:** Directly on the `UAimAssistInputModifier` instance within your Input Mapping Context. If you have different settings for hip-fire and ADS, you'll configure these on their respective modifier instances.
* **Key Parameter Groups and Their Effects:**
  * **Reticle Sizes & Depth:**
    * `AssistInnerReticleWidth`, `AssistInnerReticleHeight`: Defines the dimensions (in world space units at `ReticleDepth`) of the inner "high-assist" zone. Targets overlapping this zone get stronger assistance.
    * `AssistOuterReticleWidth`, `AssistOuterReticleHeight`: Defines the outer "low-assist" zone. Targets here still get assistance, but typically less.
    * `TargetingReticleWidth`, `TargetingReticleHeight`: Defines the overall screen region (often larger than the outer reticle) within which targets are even considered for aim assist processing after the initial world-space overlap query. Targets must have their screen bounds intersect this for further processing.
    * `ReticleDepth`: The distance from the camera at which the reticle widths/heights are effectively measured in world space. This value is scaled by FOV to maintain consistent screen presence.
    * **Guidance:** Smaller inner/outer reticles make the assist feel more precise but harder to activate. Larger reticles make it easier to engage but can feel "sloppier."
  * **Pull Strengths (Magnetism):**
    * `PullInnerStrengthHip`, `PullOuterStrengthHip`: Strength of the pull (0-1 range, typically) when a target is in the inner/outer reticle during hip-fire.
    * `PullInnerStrengthAds`, `PullOuterStrengthAds`: Same, but for ADS.
    * `PullLerpInRate`, `PullLerpOutRate`: How quickly the pull strength ramps up when a target enters an assist zone and ramps down when it leaves. Higher values mean faster transitions.
    * `PullMaxRotationRate`: Caps the maximum rotational speed (degrees per second, scaled by FOV) that the pull effect can induce. Prevents extreme camera yanking. Set to 0 to disable the cap.
    * **Guidance:** Higher pull strengths make the camera stick to targets more aggressively. Use `PullMaxRotationRate` to keep it feeling controlled.
  * **Slow Strengths (Friction):**
    * `SlowInnerStrengthHip`, `SlowOuterStrengthHip`: Amount of look sensitivity reduction (0-1 range, where 1 is full stop, though typically much lower) when a target is in the inner/outer reticle during hip-fire.
    * `SlowInnerStrengthAds`, `SlowOuterStrengthAds`: Same, but for ADS.
    * `SlowLerpInRate`, `SlowLerpOutRate`: How quickly the slow strength ramps up/down.
    * `SlowMinRotationRate`: Sets a minimum rotational speed (degrees per second, scaled by FOV) even when slowdown is active. Prevents aiming from feeling overly sluggish, especially at low sensitivities. Set to 0 to disable.
    * **Guidance:** Higher slow strengths make it easier to stay on target but can make it harder to switch between targets quickly.
  * **Target Weighting & Scoring:**
    * `TargetWeightCurve (UCurveFloat)`: A curve asset that maps "assist time" (how long a target has been continuously under an assist reticle) to an "assist weight" (0-1). This allows targets to become "stickier" the longer they are engaged.
    * `TargetScore_AssistWeight`, `TargetScore_ViewDot`, `TargetScore_ViewDotOffset`, `TargetScore_ViewDistance`: These floats are coefficients used when calculating a target's `SortScore`. They determine the relative importance of existing assist weight, angle to target, and distance when multiple targets are candidates.
    * **Guidance:** The `TargetWeightCurve` is powerful for creating a "lock-on" feel over time. Adjust scoring parameters to prioritize targets that are closer to the reticle, closer in distance, or already being assisted.
  * **General Behavior Toggles & Limits:**
    * `MaxNumberOfTargets`: The maximum number of targets to consider for detailed processing (like visibility traces and strength calculations) each frame. Higher numbers can impact performance.
    * `StrengthScale`: An overall multiplier applied to both pull and slow strengths. Useful for globally tuning the intensity of the assist.
    * `bEnableAsyncVisibilityTrace`: Toggles asynchronous line traces for visibility. Can improve main thread performance but adds one frame of latency to visibility detection.
    * `bRequireInput`: If true, aim assist effects (pull/slow) are only applied if the player is actively providing look input.
    * `bApplyPull`: Globally enables/disables the target pull mechanic.
    * `bApplyStrafePullScale`: If true, and `bRequireInput` is false or player is not looking, scales pull strength based on player's strafing movement.
    * `bApplySlowing`: Globally enables/disables the aim slowdown mechanic.
    * `bUseDynamicSlow`: If true, slowdown is reduced if the player is trying to aim _away_ from the direction of the pull, making it easier to break target lock.
    * `bUseRadialLookRates`: If true, blends yaw and pitch look rates based on stick deflection for more consistent diagonal aiming.
* **Iterative Tuning:** Aim assist tuning is an iterative process. Make small changes, test thoroughly, and gather feedback. What feels good can be subjective and game-dependent.

***

### Defining Who Gets Targeted: `FAimAssistFilter`

The `FAimAssistFilter` struct, also configured on each `UAimAssistInputModifier` instance, determines which actors are eligible to be aim assist targets.

* **`bIncludeSameFriendlyTargets`:** If true, actors on the same team as the player can be targeted by aim assist. Usually false for player-vs-player scenarios.
* **`bExcludeInstigator`:** If true, the player's own instigator (if any) is excluded.
* **`bExcludeAllAttachedToInstigator`:** If true, actors attached to the player's instigator are excluded.
* **`bExcludeRequester`:** If true, the player pawn itself is excluded (almost always true).
* **`bExcludeAllAttachedToRequester`:** If true, actors attached to the player pawn are excluded.
* **`bTraceComplexCollision`:** If true, visibility traces will use complex collision. More accurate but potentially more expensive.
* **`bExcludeDeadOrDying`:** If true, actors whose `ULyraHealthComponent` reports them as dead or dying are excluded.
* **`ExcludedClasses (TSet<TObjectPtr<UClass>>)`:** A set of actor classes to always exclude from aim assist. Add any actor types here that should never be targeted.
* **`ExclusionGameplayTags (FGameplayTagContainer)`:** Targets that have any of these gameplay tags (via their `FAimAssistTargetOptions`) will be excluded.
* **`TargetRange`:** This is actually part of `FAimAssistSettings` but acts like a filter. It's the maximum distance for initial target consideration.

### Making Your Actors Targetable

For an actor to be considered by the Aim Assist system, it needs to communicate its targetable status and properties. There are two main ways to do this:

#### Using `UAimAssistTargetComponent`

This is the simplest and most common method.

1. **Add Component:** Add the `UAimAssistTargetComponent` to your Actor Blueprint or C++ class (e.g., an enemy character Blueprint).
2. **Configure Properties:** Select the added `UAimAssistTargetComponent` in the Components panel and configure its `TargetData (FAimAssistTargetOptions)`:
   * **`Target Shape Component (TargetShapeComponent)`:**
     * This is a **`TWeakObjectPtr<UShapeComponent>`**. You need to assign a specific `UShapeComponent` from the _same actor_ that will represent the hitbox for aim assist.
     * **Crucial:** In Blueprints, you typically get a reference to the desired shape component (e.g., the Character's `CapsuleComponent` or a custom `UBoxComponent` for a headshot zone) and set this variable. In C++, you'd assign it directly in code, e.g., `TargetData.TargetShapeComponent = GetCapsuleComponent();`.
     * If left null, the component will attempt to find _any_ `UShapeComponent` on its owner during `GatherTargetOptions`, which might not be what you intend.
   * **`Associated Tags (AssociatedTags)`:** Add any `FGameplayTag`s relevant to this target. These can be used by `FAimAssistFilter::ExclusionGameplayTags` to specifically ignore certain types of targets (e.g., a tag for "Target.Invulnerable").
   * **`Is Active (bIsActive)`:** A boolean to easily enable/disable this actor as an aim assist target at runtime without removing the component.

#### Implementing `IAimAssistTaget` Directly (Advanced)

For more complex scenarios or when you want to avoid adding another component, you can implement the `IAimAssistTaget` interface directly on your `AActor` or `UActorComponent` C++ class.

1.  **Inherit from the Interface:**

    ```cpp
    // In your Actor's .h file
    #include "IAimAssistTargetInterface.h" // Ensure you have the correct path

    class AMyTargetActor : public AActor, public IAimAssistTaget
    {
        GENERATED_BODY()

    public:
        //~ Begin IAimAssistTaget interface
        virtual void GatherTargetOptions(OUT FAimAssistTargetOptions& OutTargetData) override;
        //~ End IAimAssistTaget interface

    // ... other actor code
    };
    ```
2.  **Implement `GatherTargetOptions`:**

    ```cpp
    // In your Actor's .cpp file
    void AMyTargetActor::GatherTargetOptions(OUT FAimAssistTargetOptions& OutTargetData)
    {
        // Populate OutTargetData with this actor's specifics
        OutTargetData.TargetShapeComponent = MyCollisionComponent; // Assign your desired UShapeComponent
        OutTargetData.AssociatedTags.AddTag(FGameplayTag::RequestGameplayTag(FName("Target.Type.Special")));
        OutTargetData.bIsActive = bIsCurrentlyTargetable; // Use a member variable for dynamic state
    }
    ```

    * **When to use:** This approach is useful if an actor's targetability or its shape/tags change frequently based on complex internal logic that's easier to manage directly within the actor class. It also avoids the overhead of an extra component if your actor is already component-heavy.
    * The interface is marked `meta = (CannotImplementInterfaceInBlueprint)`, so C++ implementation is required for this direct approach.

***

### Integrating with Gameplay Systems

Aim assist doesn't exist in a vacuum. Here's how it interacts with common gameplay systems:

* **Team System:**
  * `FAimAssistOwnerViewData::TeamID` is populated from the player's `ALyraPlayerState` (or a similar player state).
  * `FAimAssistFilter::bIncludeSameFriendlyTargets` uses this `TeamID` to compare against the `TeamID` of potential target actors (if they also have a player state and team concept) to filter out friendlies.
* **Health/Death System:**
  * `FAimAssistFilter::bExcludeDeadOrDying` relies on finding a `ULyraHealthComponent` on the target actor. It then checks `IsDeadOrDying()` to exclude them. Ensure your targetable characters have a compatible health component.
* **Weapon System & ADS:**
  * As mentioned, `TargetingType` on `UAimAssistInputModifier` is key.
  * Your weapon system, when entering/exiting ADS, should be responsible for enabling the `ADS`-configured `UAimAssistInputModifier` and disabling the `Normal` (hip-fire) one, and vice-versa. This is typically done by getting the `UEnhancedInputLocalPlayerSubsystem` from the `ULocalPlayer` and calling `AddPlayerMappedKey` or `RemovePlayerMappedKey` for the specific modifier instances if they are part of different IMCs, or by directly enabling/disabling modifiers if they are always present. Alternatively, you can change the active Input Mapping Context to one that includes the appropriate aim assist modifier.

By understanding these configuration points, you can tailor the aim assist to provide the exact feel and behavior your game requires. The next section will cover debugging tools and more advanced considerations.

***
