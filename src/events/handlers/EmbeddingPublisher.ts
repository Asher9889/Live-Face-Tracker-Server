import { type Redis } from "ioredis";
import EventBus from "../Event";
import EventNames from "../EventNames";
import { Employee } from "../../module/employees/domain/employee.entity";

export default class EmbeddingPublisher {
    constructor(private redis: Redis){}

    initialize(){
        EventBus.on(EventNames.EMPLOYEE_CREATED, this.handleEmployeeCreated.bind(this));
    }

    private async handleEmployeeCreated(employee: Employee){
        console.log("employee is====", employee);
        const payload = {
            id: employee.id,
            name: employee.name,
            embeddings: employee.embeddings,
            meanEmbedding: employee.meanEmbedding
        }
        await this.redis.publish(EventNames.EMPLOYEE_CREATED, JSON.stringify(payload));
        console.log("[EmbeddingPublisher] Published embedding update:", payload);
    }
}   
