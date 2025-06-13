# User Facing Experience

While `ULyraExperienceDefinition` defines the _internal_ mechanics and content of a gameplay session, the `ULyraUserFacingExperienceDefinition` defines how that experience is **presented to the player in the UI** (like menus or server browsers) and provides the necessary information to **initiate a game session** for that experience.

### Role and Purpose

* **UI Presentation:** Contains user-friendly text (Title, Subtitle, Description) and an icon (`TileIcon`) used to display the experience in frontend menus, server lists, or matchmaking interfaces.
* **Session Hosting Parameters:** Stores the specific **Map (`MapID`)** and **Experience (`ExperienceID`)** that should be loaded when a player chooses to host or join a game using this definition.
* **Session Configuration:** Holds additional parameters needed to configure the game session, such as `MaxPlayerCount`, extra URL arguments (`ExtraArgs`), and whether replays should be recorded (`bRecordReplay`).
* **Discovery & Filtering:** Provides flags (`bIsDefaultExperience`, `bShowInFrontEnd`) to help UI systems prioritize or filter which experiences are shown to the player.
* **Decoupling UI from Runtime:** Allows the UI to present options to the player without needing to load the full `ULyraExperienceDefinition` assets, only these lighter-weight "descriptor" assets.

### Creation

Create User Facing Experience Definitions in the Unreal Editor:

1. **Content Browser:** Navigate to a suitable folder (e.g., `Content/Experiences/UserFacing`).
2. **Right-Click:** Right-click in the empty space.
3. **Miscellaneous:** Select `Data Asset`.
4. **Choose Class:** Search for and select `LyraUserFacingExperienceDefinition` as the parent class.
5. **Name Asset:** Give it a descriptive name, often related to the gameplay mode and map combination (e.g., `UserFacing_TDM_Arena`, `UserFacing_CTF_Ruins`).

> [!success]
> Same steps as in the [`LyraPawnData` video](lyrapawndata.md#creation), just search for `LyraUserFacingExperienceDefinition` instead.&#x20;

### Key Properties

Configure these properties within the User Facing Experience asset's Details panel:

<img src=".gitbook/assets/image (115).png" alt="" title="Gungame user facing experience definition">

* **`Map ID` (`FPrimaryAssetId`, AllowedTypes="Map")**: **Crucial.** The Primary Asset ID of the specific map (`.umap` asset) that should be loaded when this experience is initiated.
* **`Experience ID` (`FPrimaryAssetId`, AllowedTypes="LyraExperienceDefinition")**: **Crucial.** The Primary Asset ID of the `ULyraExperienceDefinition` asset that defines the actual gameplay rules and content for this session. This is what the `ALyraGameMode` will attempt to load once the map is loaded.
* **`Extra Args` (`TMap<FString, FString>`)**: A map of key-value pairs that will be added as URL options when traveling to the map or hosting the session. Can be used to pass additional configuration specific to this session variant (e.g., `{"BotCount", "8"}`).
* **`Tile Title` (`FText`)**: The main title displayed in the UI (e.g., "Team Deathmatch").
* **`Tile Sub Title` (`FText`)**: Secondary text, often used for the map name (e.g., "Arena Map").
* **`Tile Description` (`FText`)**: Longer description shown in details panels.
* **`Tile Icon` (`TObjectPtr<UTexture2D>`)**: The image used for this experience in selection menus.
* **`Loading Screen Widget` (`TSoftClassPtr<UUserWidget>`)**: A soft reference to the specific loading screen widget class to display when transitioning into or out of this experience.
* **`bIsDefaultExperience` (`bool`)**: If true, indicates this might be prioritized in "Quick Play" scenarios or sorted first in lists.
* **`bShowInFrontEnd` (`bool`)**: If true, this experience should generally be listed in user-facing menus. Set to false for hidden, test, or tutorial experiences not meant for direct selection.
* **`bRecordReplay` (`bool`)**: If true (and the platform supports it), instructs the engine to record a replay of sessions launched with this experience.
* **`Max Player Count` (`int32`)**: The maximum number of players allowed in a session hosted with this configuration.

### Usage Flow

1. **UI Display:** Frontend menus or server browsers query the `UAssetManager` for assets of type `LyraUserFacingExperienceDefinition`. They filter based on `bShowInFrontEnd` and potentially sort using `bIsDefaultExperience`. They use `TileTitle`, `TileSubTitle`, `TileDescription`, and `TileIcon` to populate the UI elements.
2. **Player Selection:** The player chooses an experience from the UI.
3. **Hosting Request:** The UI or session management logic gets the selected `ULyraUserFacingExperienceDefinition` asset. It calls the `CreateHostingRequest(WorldContextObject)` function on this asset.
4. **`CreateHostingRequest` Function:**
   * Creates a `UCommonSession_HostSessionRequest` object (used by the `UCommonSessionSubsystem`).
   * Populates the request with data from the User Facing Experience definition:
     * Sets `MapID`.
     * Adds the `ExperienceID`'s name as an "Experience" key in the `ExtraArgs`.
     * Copies `ExtraArgs`.
     * Sets `MaxPlayerCount`.
     * Adds a "DemoRec" argument if `bRecordReplay` is true.
     * Sets the `ModeNameForAdvertisement` (often using the User Facing Experience asset's name).
   * Returns the configured request object.
5. **Start Session:** The session management logic passes the created request object to `UCommonSessionSubsystem->HostSession()`.
6. **Travel & Loading:** The session subsystem handles the necessary map travel using the `MapID` and `ExtraArgs`. Once the new map loads, the `ALyraGameMode` on the server reads the "Experience" argument from the URL options (which originated from the `ExperienceID` in the User Facing definition) and begins loading the specified `ULyraExperienceDefinition`.

### Relationship to `ULyraExperienceDefinition`

The User Facing Experience acts as a **pointer and presentation layer** for the actual `ULyraExperienceDefinition`. It allows the UI and session systems to work with user-friendly representations and hosting parameters without needing to load or understand the full complexity of the runtime Experience Definition itself until the game session actually starts. A single `ULyraExperienceDefinition` (e.g., `B_Experience_TDM`) could potentially be referenced by multiple `ULyraUserFacingExperienceDefinition` assets if you wanted to offer Team Deathmatch on several different maps (`UserFacing_TDM_MapA`, `UserFacing_TDM_MapB`).

***

The `ULyraUserFacingExperienceDefinition` is essential for bridging the gap between the player's choices in the UI and the underlying systems that launch and configure a specific gameplay session defined by a `ULyraExperienceDefinition` on a particular map.
