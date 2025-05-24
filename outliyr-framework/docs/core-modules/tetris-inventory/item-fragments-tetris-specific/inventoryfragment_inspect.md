# InventoryFragment\_Inspect

This fragment provides the necessary data and configuration for integrating an item with the 3D **Item Inspection System**, which utilizes the PocketWorlds plugin to render interactive previews. Adding this fragment to an item definition allows players to potentially view that item in a dedicated inspection viewport.

### Purpose

* **Visual Representation:** Specifies the Static Mesh or Skeletal Mesh used to represent the item in the 3D inspection view.
* **Camera Control:** Defines parameters for how the virtual camera behaves during inspection (FOV limits, zoom capability).
* **Rotation Control:** Configures how the player can rotate the item model (free rotation, axis clamping, reset behavior).
* **Icon Snapshot Config:** Provides settings (`FInspectionImageDetails`) used by the `UItemIconGeneratorComponent` if generating cached 2D icons from the 3D model is desired.

### Configuration (on `InventoryFragment_Inspect`)

Add this fragment to an `ULyraInventoryItemDefinition` and configure its properties in the Details panel:

```cpp
// Fragment providing data needed for the 3D Item Inspection system (PocketWorlds).
UCLASS(MinimalAPI)
class UInventoryFragment_Inspect : public ULyraInventoryItemFragment
{
    GENERATED_BODY()
public:
    // --- Mesh ---
    // The Static Mesh to display for inspection. Use this OR SkeletalMesh, not both typically.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TObjectPtr<UStaticMesh> StaticMesh;

    // The Skeletal Mesh to display for inspection. Use this OR StaticMesh.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TObjectPtr<USkeletalMesh> SkeletalMesh;

    // --- Camera/Zoom ---
    // Can the player zoom in/out using the mouse wheel?
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    bool bCanZoom = true;

    // Initial Field of View (degrees) when inspection starts.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float InitialFOV = 60.0f;

    // Minimum FOV allowed when zooming in (smaller value = more zoom).
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float MaxZoomInFOV = 45.0f; // Renamed for clarity, this is the *minimum* FOV value

    // Maximum FOV allowed when zooming out (larger value = less zoom).
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float MaxZoomOutFOV = 60.0f; // Renamed for clarity, this is the *maximum* FOV value

    // --- Rotation ---
    // Can the player rotate the item by dragging the mouse?
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    bool bCanRotate = true;

    /** If true, dragging rotates the camera's Spring Arm. If false, rotates the ActorSpawnPointComponent directly. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    bool bRotateSpringArm = false;

    /** Should the model snap back to DefaultInspectionRotation when the player stops rotating? */
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    bool bResetRotationOnLoseFocus = false; // Note: Implementation might be in the StageManager/Widget

    /** If bRotateSpringArm is false, should Pitch rotation be clamped? */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(EditCondition="!bRotateSpringArm"))
    bool bClampXRotationAxis = true; // Typically Pitch

    /** Min/Max Pitch angle if clamped (degrees). */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(EditCondition="bClampXRotationAxis && !bRotateSpringArm"))
    FVector2D RotationXAxisClamp = FVector2D (-75.0f, 75.0f);

    /** If bRotateSpringArm is false, should Yaw rotation be clamped? */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(EditCondition="!bRotateSpringArm"))
    bool bClampYRotationAxis = true; // Typically Yaw

    /** Min/Max Yaw angle if clamped (degrees). */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(EditCondition="bClampYRotationAxis && !bRotateSpringArm"))
    FVector2D RotationYAxisClamp = FVector2D (-35.0f, 35.0f); // Note: Clamping Yaw directly might feel odd, often left unclamped or uses spring arm rotation.

    // Initial rotation applied to the item model when inspection starts.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FRotator DefaultInspectionRotation = FRotator::ZeroRotator;

    // --- Icon Snapshot Settings ---
    // Configuration for generating a 2D inventory icon snapshot using the inspection setup.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FInspectionImageDetails InventoryIconImage = FInspectionImageDetails(false, FRotator::ZeroRotator, 1.0f, false);
};

// --- Struct for Icon Snapshot Config ---
USTRUCT(BlueprintType)
struct FInspectionImageDetails
{
    GENERATED_BODY()
    // Should the ItemIconGeneratorComponent use this setup to generate an icon?
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    bool bUseAsInventoryImage = false;

    // The specific rotation the model should have for the icon snapshot.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FRotator ImageRotation = FRotator::ZeroRotator;

    // Ratio for fitting the object to the render target size (e.g., 1.0 = fill, 0.5 = half size).
    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta = (ClampMin = "0.01", ClampMax = "10.0", UIMin = "0.01", UIMax = "10.0"))
    float FitToScreenRatio = 1.0f;

    /**
     * If true, items with the same ItemDefinition share the same cached icon render target.
     * Set to false if instances can look different (e.g., weapons with attachments).
     */
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    bool bCacheRenderTarget = true;
    // Constructors...
};
```

### Runtime Usage

This fragment primarily acts as a **data container**. Its properties are read by other systems involved in the inspection process:

1. **Initiation:** When the player triggers item inspection (e.g., via UI -> GAS Event).
2. **Pocket Level & Stage Manager:** The inspection system (likely involving `UPocketLevelBridgeSubsystem`) spawns the appropriate pocket level and gets the `APocketLevelStageManager` within it.
3. **Stage Manager Initialization (`APocketLevelStageManager::Initialise`):**
   * The `ULyraInventoryItemInstance` being inspected is passed to the `StageManager`.
   * The `StageManager` finds the `UInventoryFragment_Inspect` on the item instance using `FindFragmentByClass`.
   * It reads the `StaticMesh` or `SkeletalMesh` property and sets the corresponding mesh component in the pocket level.
   * It reads the camera (`bCanZoom`, FOV properties) and rotation (`bCanRotate`, clamp properties, `DefaultInspectionRotation`) settings from the fragment and configures its internal camera (`UCameraComponent`) and rotation logic accordingly.
   * If the item also has an `InventoryFragment_Attachment`, the `StageManager` recursively spawns and attaches visuals for those attachments.
4. **User Interaction (`UInventoryRepresentationWidget`):**
   * The widget displaying the inspection view reads properties like `bCanZoom` and `bCanRotate` from the fragment (via the stage manager or item instance) to enable/disable input handling.
   * When the user rotates (drags mouse) or zooms (mouse wheel), the widget relays these inputs to the `APocketLevelStageManager`, which uses the clamp/limit values configured in the fragment to constrain the movement.
5. **Icon Generation (`UItemIconGeneratorComponent` - Optional):**
   * If using the generator component, it reads the `InventoryIconImage` struct from the fragment.
   * If `bUseAsInventoryImage` is true, it uses `ImageRotation` and `FitToScreenRatio` when calling `APocketLevelStageManager::InitialiseSnapCaptor` to position the item correctly for the snapshot.
   * It uses `bCacheRenderTarget` to decide whether to cache the generated icon based on the item definition class or if each instance needs a unique icon.

In essence, `InventoryFragment_Inspect` acts as the configuration hub for how an item should appear and behave within the 3D inspection environment provided by the PocketWorlds integration.
