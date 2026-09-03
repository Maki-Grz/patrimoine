<script>
  import { onMount } from 'svelte';
  import { appState } from './lib/state.svelte.js';

  // UI5 Web Components Imports to register custom elements globally
  import "@ui5/webcomponents/dist/Button.js";
  import "@ui5/webcomponents/dist/Input.js";
  import "@ui5/webcomponents/dist/Select.js";
  import "@ui5/webcomponents/dist/Option.js";
  import "@ui5/webcomponents/dist/Toast.js";
  import "@ui5/webcomponents/dist/Dialog.js";
  import "@ui5/webcomponents/dist/Icon.js";
  import "@ui5/webcomponents/dist/Switch.js";
  import "@ui5/webcomponents/dist/Label.js";
  import "@ui5/webcomponents/dist/CheckBox.js";
  import "@ui5/webcomponents/dist/BusyIndicator.js";
  import "@ui5/webcomponents/dist/MessageStrip.js";
  
  // UI5 Fiori Components
  import "@ui5/webcomponents-fiori/dist/SideNavigation.js";
  import "@ui5/webcomponents-fiori/dist/SideNavigationItem.js";
  import "@ui5/webcomponents-fiori/dist/Wizard.js";

  // UI5 Icons Registration
  import "@ui5/webcomponents-icons/dist/AllIcons.js";

  // Import view components
  import Header from './components/Header.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import Accounts from './components/Accounts.svelte';
  import Distribution from './components/Distribution.svelte';
  import FlowGraph from './components/FlowGraph.svelte';
  import CashCalendar from './components/CashCalendar.svelte';
  import RecurringDebits from './components/RecurringDebits.svelte';
  import Expenses from './components/Expenses.svelte';
  import ExecutionLogs from './components/ExecutionLogs.svelte';

  onMount(() => {
    appState.loadData();
  });
</script>

<div class="app-container">
  <!-- Header Top Bar -->
  <Header />

  <!-- Main Body -->
  <div class="app-main">
    <!-- Sidebar Navigation -->
    <Sidebar />

    <!-- Main Content Area -->
    <main class="app-content">
      {#if appState.activeTab === 'dashboard'}
        <Dashboard />
      {:else if appState.activeTab === 'comptes'}
        <Accounts />
      {:else if appState.activeTab === 'distribution'}
        <Distribution />
      {:else if appState.activeTab === 'graphe'}
        <FlowGraph />
      {:else if appState.activeTab === 'calendar'}
        <CashCalendar />
      {:else if appState.activeTab === 'abonnements'}
        <RecurringDebits />
      {:else if appState.activeTab === 'depenses'}
        <Expenses />
      {:else if appState.activeTab === 'logs'}
        <ExecutionLogs />
      {/if}
    </main>
  </div>
</div>

<!-- Global Toast Alert -->
<ui5-toast bind:this={appState.toastRef} duration="3000">
  {appState.toastMessage}
</ui5-toast>
