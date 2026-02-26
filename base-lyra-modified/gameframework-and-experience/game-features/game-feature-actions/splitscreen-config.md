# Splitscreen Config

The `UGameFeatureAction_SplitscreenConfig` serves as a straightforward example of a Game Feature Action that modifies a global or per-world setting – in this case, controlling whether splitscreen functionality is forcibly disabled.

### Purpose

* **Experience-Based Configuration:** Allows specific Experiences (like competitive modes or frontend menus) to explicitly disable splitscreen support while they are active.
* **Centralized Control:** Provides a data-driven way to manage splitscreen availability tied to the Game Feature/Experience lifecycle.
* **Example Action:** Demonstrates the pattern of using a `UGameFeatureAction_WorldActionBase` to apply settings on a per-world basis and managing state across multiple potential activations.

### Configuration

Add instances of this action to the `Actions` list within a `ULyraExperienceDefinition` or `ULyraExperienceActionSet`.

<img src=".gitbook/assets/image (124).png" alt="" title="Add_SplitScreenConfig GameFeatureAction configuration">

* **`b Disable Splitscreen` (`bool`, Default: true)**: If checked (true), this action will attempt to force splitscreen to be disabled for game instances associated with the worlds where this action becomes active. If unchecked, the action effectively does nothing (it doesn't force splitscreen _on_, it only manages disabling it).

_Example Configuration (in `Experience_MainMenu` or `Experience_CompetitiveRanked`):_

* `Actions`:
  * `[index]`: `GameFeatureAction_SplitscreenConfig`
    * `b Disable Splitscreen`: `true`

### Runtime Execution Flow

This action inherits from `UGameFeatureAction_WorldActionBase`. It uses a static map (`GlobalDisableVotes`) to handle multiple features potentially wanting to disable splitscreen simultaneously.

1. **Activation (`OnGameFeatureActivating` -> `AddToWorld`):**
   * When the owning Game Feature/Experience activates for a specific world context (`FWorldContext`), the `AddToWorld` function is called.
   * It checks the `bDisableSplitscreen` flag configured on the action asset.
   * If `bDisableSplitscreen` is `true`:
     * It gets the `UGameInstance` and `UGameViewportClient` associated with the `WorldContext`.
     * It uses the `UGameViewportClient` as a key (`FObjectKey`) into the static `GlobalDisableVotes` map.
     * It **increments** the vote count for that viewport client in the `GlobalDisableVotes` map.
     * It also adds the viewport key to a `LocalDisableVotes` array specific to _this action instance_ and _this activation context_.
     * **If the vote count becomes exactly 1** (meaning this is the _first_ active action requesting disable for this viewport), it calls `GameViewportClient->SetForceDisableSplitscreen(true)` to actually disable splitscreen.
2. **Deactivation (`OnGameFeatureDeactivating`):**
   * When the owning Game Feature/Experience deactivates for a specific context, the `OnGameFeatureDeactivating` function is called.
   * It iterates through the `LocalDisableVotes` array stored for _this action instance_ and _this context_.
   * For each `FObjectKey` (representing a `UGameViewportClient`):
     * It finds the corresponding entry in the static `GlobalDisableVotes` map.
     * It **decrements** the vote count.
     * **If the vote count reaches 0:**
       * It removes the entry from `GlobalDisableVotes`.
       * It calls `GameViewportClient->SetForceDisableSplitscreen(false)` to potentially re-enable splitscreen (only if no _other_ active actions are still voting to disable it).
     * It removes the key from the `LocalDisableVotes` array for this context.

**Vote Counting Explained:** The static `GlobalDisableVotes` map ensures that splitscreen is only disabled when the _first_ request comes in and only re-enabled when the _last_ request is removed. This correctly handles scenarios where multiple active Experiences or Game Features might simultaneously require splitscreen to be disabled. The `LocalDisableVotes` array tracks which specific viewports _this particular action instance_ voted to disable, so it knows which votes to remove upon its own deactivation.

### Use Cases

* **Force Single Screen:** Ensure main menus, competitive modes, or experiences with complex full-screen UI are always run without splitscreen enabled.
* **Platform Constraints:** Potentially disable splitscreen on platforms where performance might be an issue for certain experiences.
* **Simple Configuration Example:** Serves as a clear example of how a Game Feature Action can manage a global or per-world setting using the world action base and static tracking for multiple activations.

***

While simple in its goal, the `UGameFeatureAction_SplitscreenConfig` demonstrates a robust pattern for managing shared settings affected by multiple Game Features using a voting system tracked in a static map, ensuring the setting is only truly changed when the first vote is cast and only reverted when the last vote is removed.
