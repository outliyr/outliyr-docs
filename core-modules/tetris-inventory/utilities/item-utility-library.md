# Item Utility Library

This Blueprint Function Library provides more general-purpose utility functions that can be useful in conjunction with the inventory system, particularly for scenarios involving item placement or spawning in the game world, but are not strictly tied to the core inventory management logic itself.

### `GetRandomPointsInSplineArea`

This function is designed to find random locations within a 2D area defined by a closed `USplineComponent`.

<!-- tabs:start -->
#### **C++**
```cpp
/**
 * Sample random points inside a closed spline using triangulation.
 * Projects the spline onto the XY plane for calculation.
 *
 * @param SplineComponent The closed USplineComponent defining the area boundary.
 * @param NumPoints The number of random points to generate inside the area.
 * @param RandomPoints (Output) TArray of FVectors representing the generated points (Z coordinate will match the spline's points).
 * @return True if points were successfully generated, false otherwise (e.g., invalid spline, not enough points to triangulate).
 */
UFUNCTION(BlueprintCallable, Category = "Item|ItemSpawning")
static UE_API bool GetRandomPointsInSplineArea(
    USplineComponent* SplineComponent,
    int32 NumPoints,
    TArray<FVector>& RandomPoints
);
```


#### **Blueprint**
<img src=".gitbook/assets/image (165).png" alt="" title="">

<!-- tabs:end -->

**Logic Breakdown:**

1. **Validation:** Checks if the `SplineComponent` is valid and `NumPoints` is positive.
2. **PolyPath Conversion:** Converts the `SplineComponent` into a `FGeometryScriptPolyPath` by sampling points along its length. Assumes the spline is closed and operates primarily on the XY plane.
3. **Triangulation:** Uses the `AppendDelaunayTriangulation2D` function from the Geometry Scripting plugin to triangulate the 2D polygon defined by the PolyPath vertices. This breaks the potentially complex area into a set of simple triangles.
4. **Area Calculation:** Calculates the surface area of each generated triangle.
5. **Weighted Triangle Selection:** Calculates the total area of all triangles. To ensure points are distributed evenly across the entire spline area (not clustered in smaller triangles), it randomly selects triangles based on their area (larger triangles are proportionally more likely to be chosen).
6. **Point Sampling:** For each of the `NumPoints` requested:
   * Selects a random triangle using the weighted method described above.
   * Generates a random point _within_ the bounds of that selected triangle using barycentric coordinates.
   * Adds the generated `FVector` (with its Z coordinate likely matching the original spline points on the XY plane) to the `RandomPoints` output array.
7. **Return:** Returns `true` if the process completed successfully and generated points, `false` if the spline was invalid or triangulation failed.

**Use Cases:**

* **Procedural Loot Spawning:** Define loot spawn zones in your level using closed Spline Components. Use this function to get random locations within those zones to spawn `ALyraWorldCollectable` actors (dropped items).
* **AI Patrol Points:** Generate random points within a defined area for AI navigation or patrol routes.
* **Visual Effects:** Scatter visual effect emitters randomly within a designated zone.

**Dependencies:**

* Requires the **GeometryScripting** plugin to be enabled in your project (it's often enabled by default in recent engine versions).

While not directly manipulating inventory slots, functions like this in `UItemUtilityLibrary` provide valuable tools for integrating the inventory system with the broader game world, especially concerning the physical placement and spawning of items.
