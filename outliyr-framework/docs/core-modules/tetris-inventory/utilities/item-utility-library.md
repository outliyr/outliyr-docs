# Item Utility Library

You've placed a loot chest in your level. Around it, you want 20 scattered items, ammo, health packs, loose coins, randomly distributed across an irregularly-shaped cave floor. You could hand-place them all, or you could define the area with a spline and let the system distribute them for you.

`UItemUtilityLibrary` is a Blueprint Function Library for general-purpose item utilities that complement the inventory system. These functions are not tied to grid logic, they handle the world-space side of items, particularly spawning and placement.

***

### `GetRandomPointsInSplineArea`

Generates random world-space positions inside the area enclosed by a closed `USplineComponent`. The points are uniformly distributed across the surface area, larger regions of the spline get proportionally more points, so you never end up with everything clustered in one corner.

{% tabs %}
{% tab title="C++" %}
```cpp
/**
 * Sample random points inside a closed spline using triangulation.
 * Projects the spline onto the XY plane for calculation.
 *
 * @param SplineComponent  The closed USplineComponent defining the area boundary.
 * @param NumPoints        The number of random points to generate inside the area.
 * @param RandomPoints     (Output) Array of FVectors for the generated points.
 * @return True if points were generated successfully, false otherwise.
 */
UFUNCTION(BlueprintCallable, Category = "Item|ItemSpawning")
static UE_API bool GetRandomPointsInSplineArea(
    USplineComponent* SplineComponent,
    int32 NumPoints,
    TArray<FVector>& RandomPoints
);
```
{% endtab %}

{% tab title="Blueprint" %}
<figure><img src="../../../.gitbook/assets/image (234).png" alt=""><figcaption><p>Example of ItemZoneSpawner spawning items in a random point in the spline</p></figcaption></figure>
{% endtab %}
{% endtabs %}

***

### How It Works

{% stepper %}
{% step %}
**Validation**

Checks that the `SplineComponent` is valid and `NumPoints` is positive. Returns `false` immediately if either check fails.
{% endstep %}

{% step %}
**Polygon Conversion**

Samples points along the spline to create an `FGeometryScriptPolyPath`, a 2D polygon projected onto the XY plane. The spline must be closed for this to produce a valid boundary.
{% endstep %}

{% step %}
**Triangulation**

Uses `AppendDelaunayTriangulation2D` from the Geometry Scripting plugin to break the polygon into a set of triangles. This handles arbitrary spline shapes, concave, convex, or complex.
{% endstep %}

{% step %}
**Area-Weighted Selection**

Calculates the surface area of each triangle. When selecting a triangle for point placement, larger triangles are proportionally more likely to be chosen. This is what ensures uniform distribution across the entire area rather than clustering.
{% endstep %}

{% step %}
**Point Sampling**

For each requested point, randomly selects a triangle (weighted by area) and generates a random position inside it using barycentric coordinates. The Z coordinate matches the original spline's height.
{% endstep %}
{% endstepper %}

***

### Use Cases

* **Procedural loot spawning** - Define loot zones with closed splines in your level. Generate random positions to spawn `ALyraWorldCollectable` actors (dropped items) within those zones.
* **AI patrol points** - Create randomized waypoints within a bounded patrol area.
* **Visual effects** - Scatter emitters, decals, or debris randomly within a designated region.
* **Environmental storytelling** - Distribute props like spent shell casings, scattered papers, or broken glass across an irregularly-shaped room.

{% hint style="warning" %}
This function requires the **GeometryScripting** plugin to be enabled in your project. It is enabled by default in recent engine versions, but verify this if you encounter linker errors.
{% endhint %}

***

<details>

<summary>Why barycentric coordinates?</summary>

A naive approach might pick random X and Y values within a triangle's bounding box and discard points that fall outside. This is wasteful for thin triangles and produces uneven distribution.

Barycentric coordinates guarantee that every generated point falls inside the triangle with uniform probability. Two random values are generated and transformed so the resulting point is always within the triangle's bounds, no rejection sampling needed, no wasted computation.

</details>
