import { scheduler } from "@devvit/web/server";
import { AppSetting } from ".";
import { UpgradeNotifierData } from "@fsvreddit/fsv-devvit-web-helpers";
import pluralize from "pluralize";

export enum SchedulerJob {
    CheckForUpdates = "checkForUpdates",
}

export async function configureCronJobs () {
    const schedulerJobs = await scheduler.listJobs();
    const cronJobs = schedulerJobs.filter(job => "cron" in job);
    await Promise.all(cronJobs.map(job => scheduler.cancelJob(job.id)));

    console.log(`Cancelled ${cronJobs.length} existing cron ${pluralize("job", cronJobs.length)}.`);

    // Schedule the checkForUpdates job to run every 24 hours at a random interval
    const randomMinute = Math.floor(Math.random() * 60);
    const randomHour = Math.floor(Math.random() * 24);

    const jobData: UpgradeNotifierData = {
        settingName: AppSetting.NotifyOnUpdates,
        appFriendlyName: "Automod Neo",
    };

    await scheduler.runJob({
        name: SchedulerJob.CheckForUpdates,
        cron: `${randomMinute} ${randomHour} * * *`,
        data: jobData,
    });

    console.log(`Scheduled ${SchedulerJob.CheckForUpdates} job to run at ${randomHour}:${randomMinute} every day.`);
}
