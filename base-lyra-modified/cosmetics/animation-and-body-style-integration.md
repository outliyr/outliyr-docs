# Animation & Body Style Integration

Beyond simply attaching visual elements, the Cosmetic System provides mechanisms to allow applied character parts to influence more fundamental aspects of the Pawn's appearance, such as its base Skeletal Mesh or the Animation Layers used in its Animation Blueprint. This is achieved primarily through **Gameplay Tags**.

### Concept: Tag-Driven Selection

1. **Parts Provide Tags:** Cosmetic Actors spawned via `FLyraCharacterPart` can (and should, if they need to influence the base body/anim) implement the `IGameplayTagAssetInterface`. This allows them to report a set of owned Gameplay Tags (e.g., `Cosmetic.BodyStyle.Masculine`, `Cosmetic.Armor.Heavy`, `Cosmetic.Skin.Robot`).
2. **Component Collects Tags:** The `ULyraPawnComponent_CharacterParts` gathers all Gameplay Tags from all currently applied and spawned cosmetic part Actors using GetCombinedTags().
3. **Selection Sets Define Rules:** Data structures (`FLyraAnimBodyStyleSelectionSet`, `FLyraAnimLayerSelectionSet`) define rules that map combinations of Gameplay Tags to specific assets (Skeletal Meshes or Anim Instance classes).
4. **Best Match Applied:** The `PawnComponent` (for body style) or the Animation Blueprint (typically, for anim layers) uses the collected tags and the selection set rules to determine the "best" asset to use based on the currently applied cosmetics.

### Body Style Selection (`FLyraAnimBodyStyleSelectionSet`)

This system allows the base `USkeletalMesh` of the character (the one driving the main animations) to change based on equipped cosmetics. A common use case is switching between masculine/feminine body types or different base outfits that require distinct meshes.

**Data Structure:**

<!-- tabs:start -->
#### **Blueprints**
<img src=".gitbook/assets/image (83).png" alt="" title="Body style selection in B_MannequinPawnCosmetics">


#### **C++**
```cpp
// Defined in LyraCosmeticAnimationTypes.h

USTRUCT(BlueprintType)
struct FLyraAnimBodyStyleSelectionEntry
{
    GENERATED_BODY()

    // The Skeletal Mesh to apply if the tags match.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TObjectPtr<USkeletalMesh> Mesh = nullptr;

    // All of these cosmetic tags must be present on the combined applied parts
    // for this rule to be considered a match.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(Categories="Cosmetic"))
    FGameplayTagContainer RequiredTags;
};

USTRUCT(BlueprintType)
struct FLyraAnimBodyStyleSelectionSet
{
    GENERATED_BODY()

    // List of mesh rules to check, processed in order. First match wins.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(TitleProperty=Mesh))
    TArray<FLyraAnimBodyStyleSelectionEntry> MeshRules;

    // The Skeletal Mesh to use if none of the MeshRules match the combined tags.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TObjectPtr<USkeletalMesh> DefaultMesh = nullptr;

    // Optional: If set, this Physics Asset will always be applied to the mesh,
    // overriding the one specified in the selected Skeletal Mesh asset.
    UPROPERTY(EditAnywhere)
    TObjectPtr<UPhysicsAsset> ForcedPhysicsAsset = nullptr;

    // Function to determine the best mesh based on tags.
    USkeletalMesh* SelectBestBodyStyle(const FGameplayTagContainer& CosmeticTags) const;
};
```



dd

<!-- tabs:end -->

**How it Works:**

1. **Configuration:** You configure an instance of `FLyraAnimBodyStyleSelectionSet` within the `ULyraPawnComponent_CharacterParts` details panel (the BodyMeshes property). You define rules mapping required tag combinations to specific USkeletalMesh assets and set a DefaultMesh.
2. **Trigger:** When `ULyraPawnComponent_CharacterParts::BroadcastChanged()` is called (after parts are added/removed):
3. **Tag Collection:** It calls `GetCombinedTags()` to get all tags from currently applied parts.
4. **Selection:** It calls `BodyMeshes.SelectBestBodyStyle(CombinedTags)`. This function iterates through the `MeshRules`:
   * For each rule, it checks if `CombinedTags.HasAll(Rule.RequiredTags)` is true.
   * The first rule that matches returns its associated Mesh.
   * If no rules match, it returns the `DefaultMesh`.
5. **Application:** The `PawnComponent` takes the selected `USkeletalMesh` and applies it to the parent Pawn's `USkeletalMeshComponent` using `MeshComponent->SetSkeletalMesh(SelectedMesh)`.
6. **Physics Asset:** If `ForcedPhysicsAsset` is set in the selection set, it's applied using `MeshComponent->SetPhysicsAsset(PhysicsAsset)`.

**Use Case Example:**

* **Rule 1:** Required Tags: `Cosmetic.BodyStyle.Feminine`, Mesh: `SK_Feminine_BaseBody`
* **Rule 2:** Required Tags: `Cosmetic.BodyStyle.Masculine`, Mesh: `SK_Masculine_BaseBody`
* **Default Mesh:** `SK_Masculine_BaseBody` (or some neutral default)
* If a player equips a "Female Head" part that provides the `Cosmetic.BodyStyle.Feminine` tag, the `PawnComponent` will detect this tag, match Rule 1, and set the Pawn's mesh to `SK_Feminine_BaseBody`.

### Animation Layer Selection (`FLyraAnimLayerSelectionSet`)

This system allows different Animation Blueprints (specifically, Animation Layers) to be applied based on cosmetic tags. This is useful for adding animations specific to certain armor types (e.g., bulky armor needing different additive aiming poses) or character types (e.g., robotic movement overlays).

**Data Structure:**

<!-- tabs:start -->
#### **Blueprints**
<img src=".gitbook/assets/image (84).png" alt="" title="B_RangeWeaponInstance_xxx using Animation Layer Selection">


#### **C++**
```cpp
// Defined in LyraCosmeticAnimationTypes.h

USTRUCT(BlueprintType)
struct FLyraAnimLayerSelectionEntry
{
    GENERATED_BODY()

    // The Anim Instance class (representing an Anim Layer) to apply if the tags match.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TSubclassOf<UAnimInstance> Layer;

    // All of these cosmetic tags must be present on the combined applied parts
    // for this rule to be considered a match.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(Categories="Cosmetic"))
    FGameplayTagContainer RequiredTags;
};

USTRUCT(BlueprintType)
struct FLyraAnimLayerSelectionSet
{
    GENERATED_BODY()

    // List of layer rules to check, processed in order. First match wins.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(TitleProperty=Layer))
    TArray<FLyraAnimLayerSelectionEntry> LayerRules;

    // The Anim Instance class (Layer) to use if none of the LayerRules match.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TSubclassOf<UAnimInstance> DefaultLayer;

    // Function to determine the best layer class based on tags.
    TSubclassOf<UAnimInstance> SelectBestLayer(const FGameplayTagContainer& CosmeticTags) const;
};
```



<!-- tabs:end -->

**How it Works (Integration):**

1. **Data Structure:** The `FLyraAnimLayerSelectionSet` structure itself exists and provides the `SelectBestLayer` logic, which works identically to `SelectBestBodyStyle` but returns an Anim Instance Class (`TSubclassOf<UAnimInstance>`).
2. **No Direct Application Component:** Unlike the Body Style selection, the provided code **does not** include a component or specific property on the `PawnComponent` that automatically applies the selected Anim Layer.
3. **Intended Usage (Requires AnimBP Implementation):** The intended way to use this is typically within the Pawn's main **Animation Blueprint**:
   * The `AnimBP` needs access to the combined cosmetic tags. This could be achieved by:
     * Getting the `ULyraPawnComponent_CharacterParts` from the Owning Pawn Actor and calling `GetCombinedTags()`.
     * Alternatively, creating a shared data source (like a custom component or subsystem) that caches the relevant tags or the selected layer class.
   * The AnimBP needs a reference to an `FLyraAnimLayerSelectionSet` data asset or configuration (this could be stored on the `PawnComponent`, `PawnData`, or elsewhere accessible to the `AnimBP`).
   * In the AnimBP's Update logic (e.g., `BlueprintUpdateAnimation`), call `SelectBestLayer` using the fetched tags and the selection set configuration to determine the desired `TSubclassOf<UAnimInstance>`.
   * In the AnimBP's `AnimGraph`, use a **"Linked Anim Layer"** node (or "Linked Input Pose" node depending on complexity). Set the Instance Class pin of this node dynamically based on the selected layer class determined in the update step. This dynamically links the chosen animation logic into the main graph.

**Use Case Example (AnimBP Logic):**

* Assume an `FLyraAnimLayerSelectionSet` is configured with:
  * **Rule 1:** Required Tags: `Cosmetic.Armor.Heavy`, Layer: `ABP_HeavyArmorAdditiveLayer`
  * **Default Layer:** `ABP_StandardArmorAdditiveLayer`
* The AnimBP gets the combined tags from the `PawnComponent`.
* If the tags include `Cosmetic.Armor.Heavy`, `SelectBestLayer` returns `ABP_HeavyArmorAdditiveLayer`.
* The AnimBP feeds `ABP_HeavyArmorAdditiveLayer` into the Instance Class pin of a Linked Anim Layer node responsible for additive aiming poses.
* If the tag is absent, `ABP_StandardArmorAdditiveLayer` is used instead.

### Summary

The Cosmetic System integrates with the Pawn's base visuals and animation through Gameplay Tags:

* **Body Style:** The `ULyraPawnComponent_CharacterParts` directly handles selecting and applying a base `USkeletalMesh` using `FLyraAnimBodyStyleSelectionSet` based on combined cosmetic tags.
* **Animation Layers:** The `FLyraAnimLayerSelectionSet` provides the logic for selecting an appropriate Anim Instance class based on tags, but the application requires implementation within the Pawn's Animation Blueprint using Linked Anim Layer nodes.

This tag-driven approach allows for flexible and decoupled control over the character's appearance based on the cosmetic items currently applied.

