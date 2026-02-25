# The Baking Pipeline: Finalizing Assets

Once you are satisfied with the design of your `Compound Blockout Actor`, the final step is to "bake" it into a standard Static Mesh. This process converts the heavy, procedural actor into a lightweight, performant asset that is ready to be used in your `Gameplay Maps`.

The baking pipeline, (inspired by Lyra's mesh generation scripting tools) is designed to be a two-way street, allowing you to not only finalize assets but also to easily return to the editing stage for revisions.

#### Baking from the Details Panel

The primary way to bake an asset is through the "Bake" section in the Details panel of a selected `Compound Blockout Actor`.

<figure><img src="../../../.gitbook/assets/image (4) (1) (1).png" alt=""><figcaption></figcaption></figure>

**Key Settings**

* **Bake Target Mesh:** This is a reference to a `UStaticMesh` asset in your Content Browser. When you bake, the geometry of your actor will be written into this specific asset, overwriting its contents.
* **Bake Output Folder & Asset Name:** If you are generating a new mesh, these fields determine where it will be saved and what it will be called.
* **Bake Enable Nanite:** If enabled, the resulting Static Mesh will have Nanite enabled. This is highly recommended for complex geometry.
* **Bake Collision:** Determines the type of simple collision generated for the mesh. The default, `Use Complex As Simple`, is a great starting point for blockout geometry, as it provides perfect per-polygon collision.

**The Main Actions**

You have two main buttons for baking:

1. **Generate New Static Mesh:**
   * **What it does:** Creates a brand-new `UStaticMesh` asset based on your output path/name settings, creates a corresponding `Recipe` asset, and automatically sets the new mesh as the `Bake Target Mesh` for future updates.
   * **When to use it:** The first time you bake a new blockout actor. This is the standard way to initialize a new, linked asset.
2. **Bake to Static Mesh:**
   * **What it does:** Overwrites the Static Mesh asset currently specified in the `Bake Target Mesh` property with the latest geometry from your actor. It also updates the linked `Recipe`. This button is only enabled if you have a valid target mesh selected.
   * **When to use it:** When you are iterating on an _existing_ asset. After making changes to your blockout actor, you click this to push the updates to the final asset.

#### The Asset Lifecycle: A Common Workflow

The true power of this pipeline becomes clear when you need to make changes. The system uses the **Actor Context Menu** (right-click on an actor in the level) and the **Content Browser Context Menu** (right-click on an asset) to manage the entire lifecycle of a blockout asset.

**Step 1: Creation and Baking**

You create your geometry using a `Compound Blockout Actor`. When ready, you use **Generate New Static Mesh** to create the final asset and its recipe.

**Step 2: Conversion to Static Mesh**

Your level now contains the heavy, editable `Compound Blockout Actor`. For performance, you should replace it with the optimized Static Mesh you just baked.

* **Action:** Right-click the `Compound Blockout Actor` in the viewport and select **Compound Blockout > Convert To Static Mesh**.
* **Result:** The blockout actor is deleted and replaced at the exact same location with a `AStaticMeshActor` containing your baked mesh. Your level is now using the performant, final asset.

**Step 3: Iteration and Revision**

Later, you decide a change is needed. You find one of the baked `AStaticMeshActor` instances in your level.

* **Action:** Right-click the `AStaticMeshActor` and select **Compound Blockout > Convert To Compound Blockout Actor**.
* **Result:** The system reads the recipe link from the Static Mesh's metadata. The `AStaticMeshActor` is deleted and replaced with a newly spawned, fully-editable `Compound Blockout Actor`, ready for you to make changes.

After editing, you use the **Bake to Static Mesh** button to update the asset, and then **Convert to Static Mesh** again to put the optimized actor back in the level.

**Step 4: Batch Updating (Advanced)**

If you have used the same baked mesh in 50 different places and need to update all of them, you don't need to convert each one back and forth.

1. Convert just **one** instance to a `Compound Blockout Actor` to make your edits.
2. Use **Bake to Static Mesh** to update the shared `UStaticMesh` asset.
3. **Result:** Since all 50 `AStaticMeshActor` instances reference the same asset, they will all automatically update with the new geometry.

You can also right-click on the `UStaticMesh` in the Content Browser and select **Update From Blockout Recipe** to trigger a rebake without ever needing to place an actor in the level. This disciplined workflow ensures your `Gameplay Maps` remain modular, performant, and easy to update.
