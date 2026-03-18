# UnivRennes Mobile App - Deep Dive: ADE Timetable Architecture

This document provides a comprehensive, in-depth technical analysis of the **ADE (Application Des Emplois du temps)** integration within the UnivRennes mobile application. The data mapping and architecture have been reconstructed through reverse-engineering the compiled Dart Ahead-Of-Time (AOT) machine code ([libapp.so](file:///Users/tomheliere/Downloads/fr.univ.rennes.appmobile.univrennes_2.4.5/fr.univ.rennes.appmobile.univrennes/extracted_arm/lib/armeabi-v7a/libapp.so)) of the Flutter application. 

This guide is intended for development and security teams to understand exactly how the student schedule synchronizes, caches, and operates locally and externally.

---

## 1. Architectural Overview & Design Padding

The implementation of the UnivRennes timetable follows a **Backend-For-Frontend (BFF)** caching strategy. The mobile app **does not** communicate directly with the university's underlying ADE scheduling software (which is famously a complex and slow monolithic system). 

Instead, the mobile application interacts purely with a middle-layer custom REST API. This ensures stability, enforces proper security handling, formats data into optimized JSON, and introduces crucial app-specific capabilities like custom student events and caching logic.

**Core Infrastructure Endpoints:**
*   **Production Environment:** `https://campus-app.univ-rennes.fr/api/`
*   **Staging/Test Environment:** `https://campus-app-test.univ-rennes.fr/api/`

---

## 2. API Endpoints Breakdown

We can group the API traffic found in the reverse engineering process into distinct categories. Every request typically routes via the `/timetable/` namespace.

### A. Core Fetching & Lookup Endpoints
*   **`GET /timetable/getLastFromResources?date={date}`**  
    The fundamental query to grab the schedule. It fetches the timetable JSON payload containing individual classes, rooms, and educators for a predefined time scope.
*   **`GET /timetable/vetSearch?q={query}`**  
    Powers the search utility. It performs server-side filtering allowing users to rapidly find specific professors, course names, or groups dynamically.
*   **`GET /timetable/getVetTree?etabsVets={query}`**  
    Downloads the entire university curriculum hierarchy. **VET** corresponds to "Version d'ÉTape" (a standard term within the Apogée system for French universities detailing the pedagogical structure of a diploma). This powers the UI that lets students drill down from the Master degree level all the way to their specific TD/TP group.

### B. Health, Status, and Broadcasting
*   **`GET /timetable/getAdeStatus`**  
    A lightweight ping endpoint that checks if the upstream university scheduling servers (ADE) are responding. This drives the UI state in the app (e.g., showing a warning if the sync server is unresponsive).
*   **`GET /timetable/getADEGlobalAlerts?etabsVets={query}`**  
    Fetches urgent, global banner alerts. Useful for situations like severe weather shutting down the campus or widespread IT outages.

### C. Pedagogy and User Customization (CRUD Operations)
Unlike standard ADE viewers, the UnivRennes app allows mutations to the schedule through custom student data overlays.
*   **`POST /timetable/addComment?vet={vet_id}`**  
    Appends a local or cloud-synced comment directly to an ADE event block (e.g., "Bring safety goggles" or "Room changed to Amphi B").
*   **`POST /timetable/updateCommentStatus?id={id}`**  
    Updates the visibility or status flag of a previous custom note.
*   **`POST /timetable/editEvent2`**  
    Updates modifications made to custom user-generated events.
*   **`DELETE /timetable/deleteEvent?id={id}`**  
    Removes a user-generated block.
*   **`POST /timetable/cleanUserChoices?userId={id}`**  
    A wipe function that resets the student's selected timetable groups. Used natively when a student changes their major or academic year.

---

## 3. Data Models: The "Tree" Selection System

Because ADE contains tens of thousands of individual daily courses, parsing it natively all at once would crash the mobile device. To handle this, the application defines a "Tree / Branch / Leaf" object model. Reconstructed from the internal structure:

*   `timetable_selection_tree.dart` (Represents a Faculty)
*   `timetable_selection_branch.dart` (Represents a Degree/Year)
*   `timetable_selection_leaf.dart` (Represents a specific Group/Class)

**Safeguard Implementation:**  
When a user attempts to select an entire high-level bucket (such as trying to subscribe to the entire Faculty of Sciences rather than their specific group), the Flutter app prevents the action with a hardcoded block.
> *"You cannot select this entire folder because it contains too many items. Open it to choose the sub-folders and ensure that you only select the folders/items that make up your personal timetable."*

---

## 4. Offline Resilience and Aggressive Caching Strategy

Because the primary ADE servers frequently shut down for nightly maintenance or suffer from high traffic loads, the mobile application implements an aggressive local-first database caching strategy.

1.  **Local Database Interfacing:** The app spins up a persistent local database using `TimetableStorage`. Once the JSON from `getLastFromResources` is processed natively, it sets a boolean flag `hasTimetableInMemory` to `true`.
2.  **App Boot Sequence:** On launch, the module `_getTimetableInfosFromMemory@825023618` executes. Before hitting the remote API via `/timetable/cache`, it attempts to draw the UI from local persistence.
3.  **Graceful Degradation:** If the device loses internet access, or if `getAdeStatus` fails, the app catches the timeout and renders a fallback banner natively within the timetable tab:
    > *"This may be due to the unavailability of the timetable servers, some of which are inaccessible during some of the night in particular."*
4.  Even with the warning overlaid, the UI gracefully defaults to rendering the offline copy via the `offlineTimetableButtonIfAvailable` function.

---

## 5. Elevated Privileges: Administrator Capabilities

A highly interesting discovery inside the compiled code is the presence of an administrator module bundled directly into the consumer application (`screens/admin/timetable/...`). It appears that the application alters its routing depending on the user's LDAP claims (staff vs student).

**Admin Utility Screens Found:**
*   `screens/admin/timetable/servers.dart`
*   `screens/admin/timetable/current_year.dart`

**Admin Specific Endpoints:**
*   `GET /timetable/getGlobalVetsStats`
*   `POST /timetable/updateVetStatus?vet={vet_id}`
*   `POST /timetable/updateAdeStatus`

**Purpose:**  
University IT staff or app maintainers can log into the exact same application as the students, but they unlock elevated screens allowing them to view real-time diagnostics of the timetable middleware synchronization servers. They can force synchronization updates or pause polling manually for specific faculties if Apogée or ADE is producing corrupted data.

---

## Conclusion

The UnivRennes app represents a highly mature mobile client architecture for university systems. By relying on a Backend-For-Frontend (BFF) caching middleware, the app abstracts the notoriously complex and slow ADE legacy software. It offers students offline availability, lightning-fast class searches, and the unique ability to merge their private notes seamlessly over the raw pedagogical schedule.
